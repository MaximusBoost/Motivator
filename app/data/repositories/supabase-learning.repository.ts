import type {
  AssessmentResult,
  DashboardData,
  FreeAnswerActivity,
  LearningActivity,
  LearningModule,
  ProgressStatus,
  QuizActivity,
  Subject,
  TodayPlanItem,
} from "~/data/types";
import { getSupabaseClient } from "~/lib/supabase/client";
import type { Database } from "~/lib/supabase/database.types";
import type { LearningRepository } from "./learning.repository";

type Tables = Database["public"]["Tables"];
type Row<TableName extends keyof Tables> = Tables[TableName]["Row"];

type ContentRows = {
  subjects: Row<"subjects">[];
  modules: Row<"modules">[];
  sections: Row<"module_sections">[];
  activities: Row<"learning_activities">[];
  questions: Row<"activity_questions">[];
  options: Row<"question_options">[];
  criteria: Row<"evaluation_criteria">[];
};

type UserRows = {
  progress: Row<"user_activity_progress">[];
  attempts: Row<"activity_attempts">[];
};

function dataOrThrow<T>(
  tableName: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) {
    throw new Error(`Не удалось загрузить ${tableName}: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error(`Supabase не вернул данные таблицы ${tableName}.`);
  }

  return result.data;
}

function getStatus(progressPercent: number): ProgressStatus {
  if (progressPercent >= 100) return "completed";
  if (progressPercent > 0) return "in_progress";
  return "not_started";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

async function loadContent(): Promise<ContentRows> {
  const client = getSupabaseClient();
  const [subjects, modules, sections, activities, questions, options, criteria] =
    await Promise.all([
      client.from("subjects").select("*").order("position"),
      client.from("modules").select("*").order("position"),
      client.from("module_sections").select("*").order("position"),
      client.from("learning_activities").select("*").order("position"),
      client.from("activity_questions").select("*").order("position"),
      client.from("question_options").select("*").order("position"),
      client.from("evaluation_criteria").select("*").order("position"),
    ]);

  return {
    subjects: dataOrThrow("subjects", subjects),
    modules: dataOrThrow("modules", modules),
    sections: dataOrThrow("module_sections", sections),
    activities: dataOrThrow("learning_activities", activities),
    questions: dataOrThrow("activity_questions", questions),
    options: dataOrThrow("question_options", options),
    criteria: dataOrThrow("evaluation_criteria", criteria),
  };
}

async function loadUserRows(userId?: string): Promise<UserRows> {
  if (!userId) return { progress: [], attempts: [] };

  const client = getSupabaseClient();
  const [progress, attempts] = await Promise.all([
    client.from("user_activity_progress").select("*").eq("user_id", userId),
    client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false }),
  ]);

  return {
    progress: dataOrThrow("user_activity_progress", progress),
    attempts: dataOrThrow("activity_attempts", attempts),
  };
}

function assembleSubjects(content: ContentRows, userRows: UserRows): Subject[] {
  const optionsByQuestion = new Map<string, Row<"question_options">[]>();
  for (const option of content.options) {
    const options = optionsByQuestion.get(option.question_id) ?? [];
    options.push(option);
    optionsByQuestion.set(option.question_id, options);
  }

  const questionsByActivity = new Map<string, Row<"activity_questions">[]>();
  for (const question of content.questions) {
    const questions = questionsByActivity.get(question.activity_id) ?? [];
    questions.push(question);
    questionsByActivity.set(question.activity_id, questions);
  }

  const criteriaByActivity = new Map<string, Row<"evaluation_criteria">[]>();
  for (const criterion of content.criteria) {
    const criteria = criteriaByActivity.get(criterion.activity_id) ?? [];
    criteria.push(criterion);
    criteriaByActivity.set(criterion.activity_id, criteria);
  }

  const sectionsByModule = new Map<string, Row<"module_sections">[]>();
  for (const section of content.sections) {
    const sections = sectionsByModule.get(section.module_id) ?? [];
    sections.push(section);
    sectionsByModule.set(section.module_id, sections);
  }

  const progressByActivity = new Map(
    userRows.progress.map((progress) => [progress.activity_id, progress] as const),
  );
  const attemptsByActivity = new Map<string, Row<"activity_attempts">[]>();
  for (const attempt of userRows.attempts) {
    const attempts = attemptsByActivity.get(attempt.activity_id) ?? [];
    attempts.push(attempt);
    attemptsByActivity.set(attempt.activity_id, attempts);
  }

  const activitiesByModule = new Map<string, LearningActivity[]>();
  for (const activity of content.activities) {
    const base = {
      id: activity.id,
      moduleId: activity.module_id,
      title: activity.title,
      description: activity.description,
      position: activity.position,
      estimatedMinutes: activity.estimated_minutes,
    };

    let learningActivity: LearningActivity;
    if (activity.type === "quiz") {
      learningActivity = {
        ...base,
        type: "quiz",
        questions: (questionsByActivity.get(activity.id) ?? []).map((question) => ({
          id: question.id,
          prompt: question.prompt,
          instructions: question.instructions,
          hint: question.hint ?? activity.hint,
          position: question.position,
          options: (optionsByQuestion.get(question.id) ?? []).map((option) => ({
            id: option.id,
            label: option.label,
            text: option.text,
          })),
        })),
      };
    } else if (activity.type === "free_answer") {
      learningActivity = {
        ...base,
        type: "free_answer",
        prompt: activity.prompt ?? "",
        instructions: activity.instructions ?? "",
        maxLength: activity.max_length ?? 2000,
        criteria: (criteriaByActivity.get(activity.id) ?? []).map((criterion) => ({
          id: criterion.id,
          title: criterion.title,
          weightPercent: criterion.weight_percent,
          position: criterion.position,
        })),
      };
    } else {
      learningActivity = { ...base, type: "theory" };
    }

    const activities = activitiesByModule.get(activity.module_id) ?? [];
    activities.push(learningActivity);
    activitiesByModule.set(activity.module_id, activities);
  }

  const modulesBySubject = new Map<string, LearningModule[]>();
  for (const module of content.modules) {
    const activities = activitiesByModule.get(module.id) ?? [];
    const progressPercent = average(
      activities.map(
        (activity) => progressByActivity.get(activity.id)?.progress_percent ?? 0,
      ),
    );
    const learningModule: LearningModule = {
      id: module.id,
      subjectId: module.subject_id,
      number: module.position,
      title: module.title,
      summary: module.summary,
      estimatedMinutes: module.estimated_minutes,
      objective: module.objective,
      keyPrinciple: module.key_principle,
      shortSummary: module.short_summary,
      learningTip: module.learning_tip,
      sections: (sectionsByModule.get(module.id) ?? []).map((section) => ({
        id: section.id,
        title: section.title,
        body: section.body,
        position: section.position,
      })),
      activities,
      status: getStatus(progressPercent),
      progressPercent,
    };

    const modules = modulesBySubject.get(module.subject_id) ?? [];
    modules.push(learningModule);
    modulesBySubject.set(module.subject_id, modules);
  }

  return content.subjects.map((subject) => {
    const modules = modulesBySubject.get(subject.id) ?? [];
    const activityIds = new Set(
      modules.flatMap((module) => module.activities.map((activity) => activity.id)),
    );
    const latestScoredAttempt = userRows.attempts.find(
      (attempt) => activityIds.has(attempt.activity_id) && attempt.score !== null,
    );
    const progressPercent = average(modules.map((module) => module.progressPercent));

    return {
      id: subject.id,
      code: subject.code,
      slug: subject.slug,
      title: subject.title,
      subtitle: subject.subtitle,
      theme: subject.theme,
      position: subject.position,
      estimatedMinutes: subject.estimated_minutes,
      modules,
      status: getStatus(progressPercent),
      progressPercent,
      lastScore: latestScoredAttempt?.score ?? null,
    };
  });
}

async function getSubjects(userId?: string): Promise<Subject[]> {
  const [content, userRows] = await Promise.all([loadContent(), loadUserRows(userId)]);
  return assembleSubjects(content, userRows);
}

function findActivity(
  subjects: Subject[],
  activityId: string,
): LearningActivity | null {
  for (const subject of subjects) {
    for (const module of subject.modules) {
      const activity = module.activities.find((item) => item.id === activityId);
      if (activity) return activity;
    }
  }
  return null;
}

async function getDashboard(userId?: string): Promise<DashboardData> {
  const subjects = await getSubjects(userId);
  if (!userId) {
    return {
      stats: {
        subjectsStarted: 0,
        averageScore: 0,
        quizzesCompleted: 0,
        needsReview: 0,
      },
      continueLearning: null,
      todayPlan: [],
      featuredSubjects: subjects.slice(0, 3),
    };
  }

  const client = getSupabaseClient();
  const [attemptResult, planResult] = await Promise.all([
    client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed"),
    client
      .from("daily_plan_items")
      .select("*")
      .eq("user_id", userId)
      .eq("scheduled_for", new Date().toISOString().slice(0, 10))
      .order("position"),
  ]);
  const attempts = dataOrThrow("activity_attempts", attemptResult);
  const planRows = dataOrThrow("daily_plan_items", planResult);
  const activityById = new Map(
    subjects.flatMap((subject) =>
      subject.modules.flatMap((module) =>
        module.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  const scores = attempts.flatMap((attempt) =>
    attempt.score === null ? [] : [attempt.score],
  );
  const currentSubject =
    subjects.find((subject) => subject.status === "in_progress") ?? null;
  const currentModule =
    currentSubject?.modules.find((module) => module.status !== "completed") ?? null;
  const nextActivity = currentModule?.activities[0] ?? null;
  const featuredSubjects = subjects
    .filter((subject) => subject.status === "in_progress")
    .slice(0, 3);
  const continueLearning =
    currentSubject && currentModule && nextActivity
      ? {
          subjectId: currentSubject.id,
          subjectTitle: currentSubject.title,
          subjectCode: currentSubject.code,
          moduleId: currentModule.id,
          moduleNumber: currentModule.number,
          modulesTotal: currentSubject.modules.length,
          moduleTitle: currentModule.title,
          nextActivityId: nextActivity.id,
          nextActivityTitle: nextActivity.description ?? nextActivity.title,
          progressPercent: currentSubject.progressPercent,
        }
      : null;

  return {
    stats: {
      subjectsStarted: subjects.filter((subject) => subject.status !== "not_started")
        .length,
      averageScore: average(scores),
      quizzesCompleted: attempts.filter(
        (attempt) => activityById.get(attempt.activity_id)?.type === "quiz",
      ).length,
      needsReview: attempts.filter(
        (attempt) => attempt.score !== null && attempt.score < 70,
      ).length,
    },
    continueLearning,
    todayPlan: planRows.map<TodayPlanItem>((item) => ({
      id: item.id,
      title: item.title,
      estimatedMinutes: item.estimated_minutes,
      isCompleted: item.is_completed,
      activityId: item.activity_id,
    })),
    featuredSubjects:
      featuredSubjects.length > 0 ? featuredSubjects : subjects.slice(0, 3),
  };
}

export const supabaseLearningRepository: LearningRepository = {
  getDashboard,
  getSubjects,

  async getSubjectBySlug(slug, userId) {
    const subjects = await getSubjects(userId);
    return subjects.find((subject) => subject.slug === slug) ?? null;
  },

  async getModule(moduleId, userId) {
    const subjects = await getSubjects(userId);
    for (const subject of subjects) {
      const module = subject.modules.find((item) => item.id === moduleId);
      if (module) return module;
    }
    return null;
  },

  async getQuiz(activityId) {
    const activity = findActivity(await getSubjects(), activityId);
    return activity?.type === "quiz" ? activity : null;
  },

  async getFreeAnswer(activityId) {
    const activity = findActivity(await getSubjects(), activityId);
    return activity?.type === "free_answer" ? activity : null;
  },

  async getResults(userId) {
    if (!userId) return [];

    const [subjects, userRows] = await Promise.all([
      getSubjects(userId),
      loadUserRows(userId),
    ]);
    const completedAttempts = userRows.attempts.filter(
      (attempt) => attempt.status === "completed" && attempt.score !== null,
    );
    if (completedAttempts.length === 0) return [];

    const client = getSupabaseClient();
    const [submissionResult, scoreResult] = await Promise.all([
      client.from("free_answer_submissions").select("*"),
      client.from("criterion_scores").select("*"),
    ]);
    const submissions = dataOrThrow("free_answer_submissions", submissionResult);
    const criterionScores = dataOrThrow("criterion_scores", scoreResult);
    const submissionByAttempt = new Map(
      submissions.map((submission) => [submission.attempt_id, submission] as const),
    );
    const criteria = new Map(
      subjects.flatMap((subject) =>
        subject.modules.flatMap((module) =>
          module.activities.flatMap((activity) =>
            activity.type === "free_answer"
              ? activity.criteria.map((criterion) => [criterion.id, criterion] as const)
              : [],
          ),
        ),
      ),
    );

    return completedAttempts.flatMap<AssessmentResult>((attempt) => {
      const activity = findActivity(subjects, attempt.activity_id);
      if (!activity || activity.type === "theory" || attempt.score === null) return [];

      const submission = submissionByAttempt.get(attempt.id);
      const scoreRows = submission
        ? criterionScores.filter((score) => score.submission_id === submission.id)
        : [];
      const hasAiFeedback = Boolean(
        submission?.ai_strength ||
          submission?.ai_improvement ||
          submission?.ai_recommendation,
      );

      return [
        {
          id: attempt.id,
          activityId: activity.id,
          activityType: activity.type,
          score: attempt.score,
          statusLabel: attempt.result_label ?? "Результат готов",
          summary: attempt.result_summary ?? "Проверка завершена.",
          submittedAnswer: submission?.answer ?? null,
          criterionScores: scoreRows.map((score) => ({
            criterionId: score.criterion_id,
            title: criteria.get(score.criterion_id)?.title ?? "Критерий",
            score: score.score,
          })),
          aiFeedback:
            submission && hasAiFeedback
              ? {
                  strength: submission.ai_strength ?? "",
                  improvement: submission.ai_improvement ?? "",
                  recommendation: submission.ai_recommendation ?? "",
                }
              : null,
          completedAt: attempt.completed_at ?? attempt.updated_at,
        },
      ];
    });
  },

  async saveFreeAnswerDraft(activityId, answer, userId) {
    if (!userId) {
      throw new Error("Для сохранения черновика нужен id авторизованного пользователя.");
    }

    const activity = findActivity(await getSubjects(), activityId);
    if (activity?.type !== "free_answer") {
      throw new Error("Задание со свободным ответом не найдено.");
    }

    const client = getSupabaseClient();
    const existingAttemptResult = await client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("activity_id", activityId)
      .eq("status", "draft")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAttemptResult.error) {
      throw new Error(`Не удалось найти черновик: ${existingAttemptResult.error.message}`);
    }

    let attempt = existingAttemptResult.data;
    if (!attempt) {
      const createdAttempt = await client
        .from("activity_attempts")
        .insert({ user_id: userId, activity_id: activityId, status: "draft" })
        .select("*")
        .single();
      attempt = dataOrThrow("activity_attempts", createdAttempt);
    }

    const savedSubmission = await client
      .from("free_answer_submissions")
      .upsert({ attempt_id: attempt.id, answer }, { onConflict: "attempt_id" })
      .select("*")
      .single();
    const submission = dataOrThrow("free_answer_submissions", savedSubmission);

    return {
      activityId,
      answer: submission.answer,
      updatedAt: submission.updated_at,
    };
  },
};
