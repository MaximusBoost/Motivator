import type {
  AssessmentResult,
  DashboardData,
  FreeAnswerActivity,
  LearningActivity,
  LearningModule,
  PracticeResult,
  PhysicalTrainingAdvice,
  ProgressStatus,
  QualificationExamResult,
  QualificationProfile,
  QuizActivity,
  Subject,
  TodayPlanItem,
} from "~/data/types";
import {
  buildQualificationExamResult,
  buildQualificationRoadmap,
  QUALIFICATION_POLICY_VERSION,
  reachesQualification,
} from "~/data/qualification-policy";
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

function mapQualificationProfile(
  row: Row<"user_qualification_profiles">,
): QualificationProfile {
  if (row.target_qualification === "none") {
    throw new Error("В профиле не выбрана целевая классная квалификация.");
  }

  return {
    userId: row.user_id,
    isActiveServiceMember: row.is_active_service_member,
    serviceType: row.service_type,
    personnelCategory: row.personnel_category,
    positionProfile: row.position_profile,
    hasSubordinates: row.has_subordinates,
    serviceDirection: row.service_direction,
    serviceStartedAt: row.service_started_at,
    currentQualification: row.current_qualification,
    qualificationAwardedAt: row.qualification_awarded_at,
    qualificationExpiresAt: row.qualification_expires_at,
    targetQualification: row.target_qualification,
    policyVersion: row.policy_version,
    onboardingCompletedAt: row.onboarding_completed_at,
    activeServiceConfirmedAt: row.active_service_confirmed_at,
    updatedAt: row.updated_at,
  };
}

function mapPracticeResult(row: Row<"user_practice_results">): PracticeResult {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    subjectId: row.subject_id,
    title: row.title,
    value: Number(row.value),
    unit: row.unit,
    grade: row.grade,
    performedAt: row.performed_at,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhysicalTrainingAdvice(
  row: Row<"physical_training_advice">,
): PhysicalTrainingAdvice {
  const recommendations = Array.isArray(row.recommendations)
    ? row.recommendations.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: row.id,
    userId: row.user_id,
    basedOnResultId: row.based_on_result_id,
    summary: row.summary,
    recommendations,
    caution: row.caution,
    source: row.source,
    generatedAt: row.generated_at,
  };
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
  const [attemptResult, planResult, progressResult] = await Promise.all([
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
    client
      .from("user_activity_progress")
      .select("*")
      .eq("user_id", userId),
  ]);
  const attempts = dataOrThrow("activity_attempts", attemptResult);
  const planRows = dataOrThrow("daily_plan_items", planResult);
  const progressRows = dataOrThrow("user_activity_progress", progressResult);
  const progressByActivity = new Map(
    progressRows.map((progress) => [progress.activity_id, progress] as const),
  );
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
  const nextActivity = currentModule?.activities.find(
    (activity) => progressByActivity.get(activity.id)?.status !== "completed",
  ) ?? null;
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

async function loadQualificationExamResult(
  attemptId: string,
  userId: string,
): Promise<QualificationExamResult | null> {
  const client = getSupabaseClient();
  const attemptResult = await client
    .from("qualification_exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (attemptResult.error) {
    throw new Error(`Не удалось загрузить пробное испытание: ${attemptResult.error.message}`);
  }
  const attempt = attemptResult.data;
  if (!attempt) return null;
  if (attempt.target_qualification === "none") {
    throw new Error("В попытке отсутствует целевая классная квалификация.");
  }

  const [subjectRowsResult, subjects] = await Promise.all([
    client
      .from("qualification_exam_subject_results")
      .select("*")
      .eq("attempt_id", attempt.id),
    getSubjects(userId),
  ]);
  const subjectRows = dataOrThrow(
    "qualification_exam_subject_results",
    subjectRowsResult,
  );
  const titleById = new Map(subjects.map((subject) => [subject.id, subject.title] as const));
  const subjectResults = subjectRows.map((row) => ({
    subjectId: row.subject_id,
    subjectTitle: titleById.get(row.subject_id) ?? "Учебный предмет",
    correctAnswers: row.correct_answers,
    totalQuestions: row.total_questions,
    scorePercent: row.score_percent,
    grade: row.grade,
  }));
  const result = buildQualificationExamResult({
    id: attempt.id,
    targetQualification: attempt.target_qualification,
    physicalGrade: attempt.physical_grade,
    subjectResults,
    completedAt: attempt.completed_at,
  });

  return {
    ...result,
    predictedQualification: attempt.predicted_qualification,
    qualifiesForTarget: attempt.qualifies_for_target,
    averageScorePercent: attempt.average_score_percent,
    policyVersion: attempt.policy_version,
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

  async getResult(attemptId, userId) {
    if (!userId) return null;

    const completedResult = (await this.getResults(userId)).find(
      (result) => result.id === attemptId,
    );
    if (completedResult) return completedResult;

    const client = getSupabaseClient();
    const attemptResult = await client
      .from("activity_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    if (attemptResult.error) {
      throw new Error(`Не удалось загрузить результат: ${attemptResult.error.message}`);
    }
    const attempt = attemptResult.data;
    if (!attempt) return null;

    const submissionResult = await client
      .from("free_answer_submissions")
      .select("*")
      .eq("attempt_id", attempt.id)
      .maybeSingle();
    if (submissionResult.error) {
      throw new Error(`Не удалось загрузить ответ: ${submissionResult.error.message}`);
    }

    return {
      id: attempt.id,
      activityId: attempt.activity_id,
      activityType: "free_answer",
      score: attempt.score ?? 0,
      statusLabel: "Ответ отправлен",
      summary: "Ответ сохранён и ожидает серверной проверки. Результат появится здесь после завершения анализа.",
      submittedAnswer: submissionResult.data?.answer ?? null,
      criterionScores: [],
      aiFeedback: null,
      completedAt: attempt.submitted_at ?? attempt.updated_at,
    };
  },

  async submitQuiz(activityId, answers, userId) {
    if (!userId) throw new Error("Для отправки теста необходимо войти.");

    const client = getSupabaseClient();
    const submission = await client.rpc("submit_quiz", {
      p_activity_id: activityId,
      p_answers: answers,
    });
    const rows = dataOrThrow("submit_quiz", submission);
    const row = rows[0];
    if (!row) throw new Error("Сервер не вернул результат теста.");

    return {
      id: row.attempt_id,
      activityId,
      activityType: "quiz",
      score: row.score,
      statusLabel:
        row.score >= 90 ? "Отличный результат" :
        row.score >= 75 ? "Хороший результат" :
        row.score >= 60 ? "Тест пройден" :
        "Нужно повторить тему",
      summary: `Правильных ответов: ${row.correct_answers} из ${row.total_questions}.`,
      submittedAnswer: null,
      criterionScores: [],
      aiFeedback: null,
      completedAt: new Date().toISOString(),
    };
  },

  async submitFreeAnswer(activityId, answer, userId) {
    if (!userId) throw new Error("Для отправки ответа необходимо войти.");
    const activity = findActivity(await getSubjects(userId), activityId);
    if (activity?.type !== "free_answer") {
      throw new Error("Задание со свободным ответом не найдено.");
    }

    const client = getSupabaseClient();
    const existingAttempt = await client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("activity_id", activityId)
      .eq("status", "draft")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAttempt.error) {
      throw new Error(`Не удалось найти черновик: ${existingAttempt.error.message}`);
    }

    let attempt = existingAttempt.data;
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
      .upsert({ attempt_id: attempt.id, answer: answer.trim() }, { onConflict: "attempt_id" });
    if (savedSubmission.error) {
      throw new Error(`Не удалось сохранить ответ: ${savedSubmission.error.message}`);
    }

    const submittedAt = new Date().toISOString();
    const [attemptUpdate, progressUpdate] = await Promise.all([
      client
        .from("activity_attempts")
        .update({ status: "submitted", submitted_at: submittedAt })
        .eq("id", attempt.id),
      client
        .from("user_activity_progress")
        .upsert(
          { user_id: userId, activity_id: activityId, status: "completed", progress_percent: 100 },
          { onConflict: "user_id,activity_id" },
        ),
    ]);
    if (attemptUpdate.error) {
      throw new Error(`Не удалось отправить ответ: ${attemptUpdate.error.message}`);
    }
    if (progressUpdate.error) {
      throw new Error(`Не удалось обновить прогресс: ${progressUpdate.error.message}`);
    }

    void client.functions
      .invoke("review-free-answer", { body: { attemptId: attempt.id } })
      .catch(() => undefined);

    return {
      id: attempt.id,
      activityId,
      activityType: "free_answer",
      score: 0,
      statusLabel: "Ответ отправлен",
      summary: "Ответ ожидает серверной проверки. После подключения AI-функции здесь появятся балл и рекомендации.",
      submittedAnswer: answer.trim(),
      criterionScores: [],
      aiFeedback: null,
      completedAt: submittedAt,
    };
  },

  async completeTheory(activityId, userId) {
    if (!userId) throw new Error("Для обновления прогресса необходимо войти.");
    const client = getSupabaseClient();
    const result = await client
      .from("user_activity_progress")
      .upsert(
        { user_id: userId, activity_id: activityId, status: "completed", progress_percent: 100 },
        { onConflict: "user_id,activity_id" },
      );
    if (result.error) {
      throw new Error(`Не удалось отметить материал прочитанным: ${result.error.message}`);
    }
  },

  async saveQuizProgress(activityId, answeredCount, totalQuestions, userId) {
    if (!userId) throw new Error("Для обновления прогресса необходимо войти.");
    const progressPercent = Math.min(
      99,
      Math.max(0, Math.round(answeredCount * 100 / Math.max(1, totalQuestions))),
    );
    const client = getSupabaseClient();
    const result = await client
      .from("user_activity_progress")
      .upsert(
        {
          user_id: userId,
          activity_id: activityId,
          status: progressPercent > 0 ? "in_progress" : "not_started",
          progress_percent: progressPercent,
        },
        { onConflict: "user_id,activity_id" },
      );
    if (result.error) {
      throw new Error(`Не удалось сохранить прогресс теста: ${result.error.message}`);
    }
  },

  async setTodayPlanItemCompleted(itemId, isCompleted, userId) {
    if (!userId) throw new Error("Для обновления плана необходимо войти.");
    const client = getSupabaseClient();
    const result = await client
      .from("daily_plan_items")
      .update({ is_completed: isCompleted })
      .eq("id", itemId)
      .eq("user_id", userId);
    if (result.error) {
      throw new Error(`Не удалось обновить план: ${result.error.message}`);
    }
  },

  async getGoals(userId) {
    if (!userId) return [];
    const client = getSupabaseClient();
    const result = await client
      .from("user_subject_goals")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    const rows = dataOrThrow("user_subject_goals", result);
    return rows.map((row) => ({
      subjectId: row.subject_id,
      targetGrade: row.target_grade,
      updatedAt: row.updated_at,
    }));
  },

  async setGoal(subjectId, targetGrade, userId) {
    if (!userId) throw new Error("Для сохранения цели необходимо войти.");
    const client = getSupabaseClient();
    const result = await client
      .from("user_subject_goals")
      .upsert(
        { user_id: userId, subject_id: subjectId, target_grade: targetGrade },
        { onConflict: "user_id,subject_id" },
      )
      .select("*")
      .single();
    const row = dataOrThrow("user_subject_goals", result);
    return {
      subjectId: row.subject_id,
      targetGrade: row.target_grade,
      updatedAt: row.updated_at,
    };
  },

  async getQualificationProfile(userId) {
    if (!userId) return null;
    const client = getSupabaseClient();
    const result = await client
      .from("user_qualification_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (result.error) {
      throw new Error(`Не удалось загрузить персональный маршрут: ${result.error.message}`);
    }
    return result.data ? mapQualificationProfile(result.data) : null;
  },

  async saveQualificationProfile(input, userId) {
    if (!userId) throw new Error("Для настройки маршрута необходимо войти.");
    if (!input.isActiveServiceMember) {
      throw new Error("Приложение предназначено только для действующих военнослужащих.");
    }
    if (input.serviceType === "conscript" && input.targetQualification === "master") {
      throw new Error("Для службы по призыву цель «Мастер» не предусмотрена.");
    }
    if (
      input.currentQualification !== input.targetQualification &&
      reachesQualification(input.currentQualification, input.targetQualification)
    ) {
      throw new Error("Целевая классность не может быть ниже текущей.");
    }
    const client = getSupabaseClient();
    const result = await client
      .from("user_qualification_profiles")
      .upsert(
        {
          user_id: userId,
          is_active_service_member: true,
          active_service_confirmed_at: new Date().toISOString(),
          service_type: input.serviceType,
          personnel_category: input.personnelCategory,
          position_profile: input.positionProfile,
          has_subordinates: input.hasSubordinates,
          service_direction: input.serviceDirection,
          service_started_at: input.serviceStartedAt,
          current_qualification: input.currentQualification,
          qualification_awarded_at: input.qualificationAwardedAt,
          qualification_expires_at: input.qualificationExpiresAt,
          target_qualification: input.targetQualification,
          policy_version: QUALIFICATION_POLICY_VERSION,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    return mapQualificationProfile(dataOrThrow("user_qualification_profiles", result));
  },

  async getQualificationRoadmap(userId) {
    const [profile, subjects, practiceResults] = await Promise.all([
      this.getQualificationProfile(userId),
      getSubjects(userId),
      this.getPracticeResults(userId),
    ]);
    let latestExam: QualificationExamResult | null = null;

    if (userId) {
      const client = getSupabaseClient();
      const attemptResult = await client
        .from("qualification_exam_attempts")
        .select("id")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (attemptResult.error) {
        throw new Error(`Не удалось загрузить историю испытаний: ${attemptResult.error.message}`);
      }
      if (attemptResult.data) {
        latestExam = await loadQualificationExamResult(attemptResult.data.id, userId);
      }
    }

    return buildQualificationRoadmap({
      profile,
      subjects,
      practiceResults,
      examResults: latestExam ? [latestExam] : [],
    });
  },

  async createQualificationExam(subjectIds, userId) {
    const uniqueSubjectIds = [...new Set(subjectIds)];
    if (uniqueSubjectIds.length < 4) {
      throw new Error("Для пробного испытания выберите не менее четырёх предметов.");
    }
    const [profile, subjects] = await Promise.all([
      this.getQualificationProfile(userId),
      getSubjects(userId),
    ]);
    if (!profile) throw new Error("Сначала настройте персональный маршрут.");

    const examSubjects = uniqueSubjectIds.map((subjectId) => {
      const subject = subjects.find((item) => item.id === subjectId);
      if (!subject) throw new Error("Один из выбранных предметов не найден.");
      const questions = subject.modules
        .flatMap((module) => module.activities)
        .filter((activity): activity is QuizActivity => activity.type === "quiz")
        .flatMap((activity) => activity.questions)
        .slice(0, 10)
        .map((question) => ({ ...question, hint: null }));
      if (questions.length < 10) {
        throw new Error(`Для предмета «${subject.title}» требуется не менее 10 тестовых вопросов.`);
      }
      return {
        subjectId: subject.id,
        subjectTitle: subject.title,
        subjectTheme: subject.theme,
        questions,
      };
    });

    return {
      policyVersion: QUALIFICATION_POLICY_VERSION,
      targetQualification: profile.targetQualification,
      subjects: examSubjects,
      questionsPerSubject: 10,
      startedAt: new Date().toISOString(),
    };
  },

  async submitQualificationExam(exam, answers, userId) {
    if (!userId) throw new Error("Для отправки испытания необходимо войти.");
    const client = getSupabaseClient();
    const result = await client.rpc("submit_qualification_exam", {
      p_subject_ids: exam.subjects.map((subject) => subject.subjectId),
      p_answers: answers,
      p_started_at: exam.startedAt,
    });
    const rows = dataOrThrow("submit_qualification_exam", result);
    const attempt = rows[0];
    if (!attempt) throw new Error("Сервер не вернул результат пробного испытания.");
    const examResult = await loadQualificationExamResult(attempt.attempt_id, userId);
    if (!examResult) throw new Error("Не удалось загрузить результат пробного испытания.");
    return examResult;
  },

  async getQualificationExamResult(attemptId, userId) {
    if (!userId) return null;
    return loadQualificationExamResult(attemptId, userId);
  },

  async getPracticeResults(userId) {
    if (!userId) return [];
    const client = getSupabaseClient();
    const result = await client
      .from("user_practice_results")
      .select("*")
      .eq("user_id", userId)
      .order("performed_at", { ascending: false });
    return dataOrThrow("user_practice_results", result).map(mapPracticeResult);
  },

  async getPhysicalTrainingAdvice(userId) {
    if (!userId) return null;
    const client = getSupabaseClient();
    const result = await client
      .from("physical_training_advice")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error(`Не удалось загрузить рекомендацию по физподготовке: ${result.error.message}`);
    }
    return result.data ? mapPhysicalTrainingAdvice(result.data) : null;
  },

  async savePracticeResult(input, userId) {
    if (!userId) throw new Error("Для сохранения результата необходимо войти.");
    const client = getSupabaseClient();
    const result = await client
      .from("user_practice_results")
      .insert({
        user_id: userId,
        category: input.category,
        subject_id: input.subjectId,
        title: input.title.trim(),
        value: input.value,
        unit: input.unit.trim(),
        grade: input.grade,
        performed_at: input.performedAt,
        notes: input.notes?.trim() || null,
      })
      .select("*")
      .single();
    const savedResult = mapPracticeResult(dataOrThrow("user_practice_results", result));
    if (savedResult.category === "physical") {
      void client.functions
        .invoke("advise-physical-training", { body: { resultId: savedResult.id } })
        .catch(() => undefined);
    }
    return savedResult;
  },

  async deletePracticeResult(resultId, userId) {
    if (!userId) throw new Error("Для удаления результата необходимо войти.");
    const client = getSupabaseClient();
    const result = await client
      .from("user_practice_results")
      .delete()
      .eq("id", resultId)
      .eq("user_id", userId);
    if (result.error) {
      throw new Error(`Не удалось удалить результат: ${result.error.message}`);
    }
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
