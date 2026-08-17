import type {
  AssessmentResult,
  FreeAnswerActivity,
  LearningActivity,
  LearningModule,
  PhysicalProfile,
  PracticeResult,
  PhysicalTrainingAdvice,
  ProgressStatus,
  QualificationExamResult,
  QualificationProfile,
  QuizActivity,
  QuizQuestion,
  Subject,
  SubjectGoal,
  TargetGrade,
  TodayPlanItem,
} from "~/data/types";
import {
  buildQualificationExamResult,
  buildQualificationRoadmap,
  gradeQualificationTest,
  isAllowedQualificationTarget,
  getNextQualificationLevel,
  QUALIFICATION_POLICY_VERSION,
} from "~/data/qualification-policy";
import {
  assessPhysicalResults,
  calculateAge,
  PHYSICAL_POLICY_VERSION,
} from "~/data/physical-training-policy";
import {
  curriculumSources,
  sourceBasedCurriculum,
  type CurriculumModule,
  type SourceBasedSubjectId,
} from "~/data/curriculum-content";
import { requestLocalFreeAnswerReview } from "~/lib/ai/free-answer-review.client";
import type { LearningRepository } from "./learning.repository";

const optionTexts = [
  "Сначала оценить условия, риски и исходные данные",
  "Сразу перейти к действию без предварительной оценки",
  "Начать с оформления результата независимо от ситуации",
  "Ориентироваться только на скорость выполнения",
];

const correctOptionByQuestionId = new Map<string, string>();

function createGenericQuestions(activityId: string): QuizQuestion[] {
  return [1, 2, 3].map((position) => {
    const questionId = `${activityId}-q${position}`;
    const options = optionTexts.map((text, optionIndex) => ({
      id: `${questionId}-o${optionIndex + 1}`,
      label: String.fromCharCode(65 + optionIndex),
      text,
    }));
    correctOptionByQuestionId.set(questionId, options[0].id);
    return {
      id: questionId,
      prompt:
        position === 1
          ? "Какой шаг алгоритма выполняется первым?"
          : "Что необходимо сделать перед переходом к следующему этапу?",
      instructions: "Выберите один вариант.",
      hint: "Вспомните последовательность действий из теоретической части.",
      position,
      options,
    };
  });
}

function createCurriculumQuestions(
  activityId: string,
  content: CurriculumModule,
): QuizQuestion[] {
  return content.questions.map((question, index) => {
    const questionId = `${activityId}-q${index + 1}`;
    const options = question.options.map((text, optionIndex) => ({
      id: `${questionId}-o${optionIndex + 1}`,
      label: String.fromCharCode(65 + optionIndex),
      text,
    }));
    correctOptionByQuestionId.set(questionId, options[question.correctIndex].id);
    return {
      id: questionId,
      prompt: question.prompt,
      instructions: "Выберите один вариант.",
      hint: question.hint,
      position: index + 1,
      options,
    };
  });
}

function createActivities(moduleId: string, content?: CurriculumModule): LearningActivity[] {
  const quizId = `${moduleId}-quiz`;
  const activities: LearningActivity[] = [
    {
      id: `${moduleId}-theory`,
      moduleId,
      type: "theory",
      title: "Теория",
      description: "Теоретический материал",
      position: 1,
      estimatedMinutes: 12,
    },
    {
      id: quizId,
      moduleId,
      type: "quiz",
      title: content?.summary === "Итоговый тест" ? "Итоговая проверка" : "Проверка знаний",
      description: content ? `Тест по теме «${content.title}»` : "Тест по материалам модуля",
      position: 2,
      estimatedMinutes: 15,
      questions: content
        ? createCurriculumQuestions(quizId, content)
        : createGenericQuestions(quizId),
    },
  ];

  if (content?.freeAnswer) {
    const activityId = `${moduleId}-free-answer`;
    activities.push({
      id: activityId,
      moduleId,
      type: "free_answer",
      title: content.freeAnswer.title,
      description: content.freeAnswer.description,
      position: 3,
      estimatedMinutes: 20,
      prompt: content.freeAnswer.prompt,
      instructions: content.freeAnswer.instructions,
      maxLength: content.freeAnswer.maxLength,
      criteria: content.freeAnswer.criteria.map((criterion, index) => ({
        id: `${activityId}-criterion-${index + 1}`,
        title: criterion.title,
        weightPercent: criterion.weightPercent,
        position: index + 1,
      })),
    });
  }

  return activities;
}

function createModule(
  subjectId: string,
  number: number,
  title: string,
  status: ProgressStatus = "not_started",
  progressPercent = 0,
  summary = "Теория + тест",
  content?: CurriculumModule,
): LearningModule {
  const id = `${subjectId}-m${number}`;

  return {
    id,
    subjectId,
    number,
    title: content?.title ?? title,
    summary: content?.summary ?? summary,
    estimatedMinutes: content?.estimatedMinutes ?? 25,
    objective: content?.objective ?? null,
    keyPrinciple: content?.keyPrinciple ?? null,
    shortSummary: content?.shortSummary ?? null,
    learningTip: content?.learningTip ?? null,
    sections: content?.sections.map((section, index) => ({
      id: `${id}-section-${index + 1}`,
      title: section.title,
      body: section.body,
      position: index + 1,
    })) ?? [],
    sources: content?.sourceKeys.map((sourceKey) => {
      const source = curriculumSources.find((item) => item.key === sourceKey);
      if (!source) {
        throw new Error(`Curriculum source ${sourceKey} is missing.`);
      }
      return {
        id: source.key,
        title: source.title,
        kind: source.kind,
        fileName: source.fileName,
        uri: source.uri,
        versionLabel: source.versionLabel,
        verifiedAt: source.verifiedAt,
        isCurrentVerified: source.isCurrentVerified,
        notes: source.notes,
        locator: content.sourceLocator,
      };
    }) ?? [],
    activities: createActivities(id, content),
    status,
    progressPercent,
  };
}

function createSubject(
  id: string,
  code: string,
  slug: string,
  title: string,
  subtitle: string,
  theme: "blue" | "olive",
  position: number,
  progressPercent: number,
  moduleNames: string[],
  lastScore: number | null = null,
): Subject {
  const curriculum = id in sourceBasedCurriculum
    ? sourceBasedCurriculum[id as SourceBasedSubjectId]
    : null;
  const status: ProgressStatus =
    progressPercent === 0 ? "not_started" : progressPercent === 100 ? "completed" : "in_progress";
  const moduleDefinitions = curriculum?.modules ?? moduleNames.map((title, index) => ({
    number: index + 1,
    title,
  }));

  return {
    id,
    code,
    slug,
    title,
    subtitle: curriculum?.subtitle ?? subtitle,
    theme,
    position,
    estimatedMinutes: curriculum
      ? curriculum.modules.reduce((sum, module) => sum + module.estimatedMinutes, 0)
      : moduleNames.length * 25,
    modules: moduleDefinitions.map((definition, index) => {
            const moduleProgress = Math.max(0, Math.min(100, progressPercent * 2 - index * 24));
            const moduleStatus: ProgressStatus =
              moduleProgress >= 100
                ? "completed"
                : moduleProgress > 0
                  ? "in_progress"
                  : "not_started";
            const content = curriculum?.modules[index];
            return createModule(
              id,
              definition.number,
              definition.title,
              moduleStatus,
              moduleProgress,
              content?.summary,
              content,
            );
          }),
    status,
    progressPercent,
    lastScore,
  };
}

const subjects: Subject[] = [
  createSubject(
    "medical",
    "01",
    "medical-training",
    "Медицинская подготовка",
    "Первая помощь • алгоритмы",
    "blue",
    1,
    62,
    sourceBasedCurriculum.medical.modules.map((module) => module.title),
    82,
  ),
  createSubject(
    "firearms",
    "02",
    "firearms-training",
    "Огневая подготовка",
    "Теория • безопасность",
    "blue",
    2,
    44,
    ["Меры безопасности", "Основы устройства", "Подготовка к применению", "Положения", "Практические сценарии", "Контроль знаний"],
    71,
  ),
  createSubject(
    "rhb",
    "03",
    "rhb-protection",
    "РХБ защита",
    "Средства защиты • основы",
    "olive",
    3,
    81,
    ["Виды угроз", "Средства защиты", "Порядок применения", "Действия по сигналу", "Итоговая проверка"],
    88,
  ),
  createSubject(
    "tactics",
    "04",
    "tactical-training",
    "Тактическая подготовка",
    "Теория • взаимодействие",
    "olive",
    4,
    33,
    ["Основы тактики", "Наблюдение", "Передвижение", "Взаимодействие", "Организация действий", "Сценарии", "Итоговый тест"],
    64,
  ),
  createSubject(
    "topography",
    "05",
    "military-topography",
    "Военная топография",
    "Карты • ориентирование",
    "blue",
    5,
    26,
    ["Топографические карты", "Условные знаки", "Координаты", "Ориентирование", "Измерения", "Маршруты", "Контроль знаний"],
    59,
  ),
  createSubject(
    "engineering",
    "06",
    "engineering-training",
    "Инженерная подготовка",
    "Общие положения",
    "blue",
    6,
    0,
    ["Общие положения", "Инженерные средства", "Оборудование позиций", "Итоговый тест"],
  ),
  createSubject(
    "regulations",
    "07",
    "military-regulations",
    "Общевоинские уставы",
    "Основные положения",
    "olive",
    7,
    91,
    ["Общие обязанности", "Внутренний порядок", "Взаимоотношения", "Суточный наряд", "Итоговая проверка"],
    93,
  ),
];

const medicalFreeAnswer = subjects
  .find((subject) => subject.id === "medical")
  ?.modules.flatMap((module) => module.activities)
  .find((activity): activity is FreeAnswerActivity => activity.type === "free_answer");

if (!medicalFreeAnswer) {
  throw new Error("Source-based medical free-answer activity is missing.");
}

const results: AssessmentResult[] = [
  {
    id: "result-medical-free-answer-1",
    activityId: medicalFreeAnswer.id,
    activityType: "free_answer",
    reviewStatus: "completed",
    score: 82,
    statusLabel: "Хороший результат",
    summary:
      "Ответ раскрывает основную логику задания. Для более высокого результата не хватает детализации в двух ключевых пунктах.",
    submittedAnswer:
      "Сначала оцениваю безопасность места, затем проверяю сознание и дыхание, организую вызов помощи, устраняю непосредственную угрозу жизни в пределах подготовки и продолжаю наблюдение до передачи специалистам.",
    criterionScores: medicalFreeAnswer.criteria.map((criterion, index) => ({
      criterionId: criterion.id,
      title: criterion.title,
      score: [88, 84, 80, 92][index] ?? 80,
    })),
    aiFeedback: {
      strength: "Последовательность рассуждения понятна и не содержит резких переходов.",
      improvement:
        "Добавьте, какие сведения необходимо передать медицинским специалистам и как контролировать изменение состояния.",
      recommendation: "Повторить раздел «Приоритет и наблюдение».",
    },
    completedAt: "2026-08-14T14:30:00.000Z",
  },
];

const drafts = new Map<string, string>();

const mockTodayPlan: TodayPlanItem[] = [
  {
    id: "plan-rhb-review",
    title: "Повторить РХБ защиту",
    estimatedMinutes: 10,
    isCompleted: true,
    activityId: "rhb-m2-theory",
  },
  {
    id: "plan-topography-quiz",
    title: "Пройти тест по топографии",
    estimatedMinutes: 15,
    isCompleted: false,
    activityId: "topography-m1-quiz",
  },
  {
    id: "plan-medical-answer",
    title: "Развернутый ответ: медицина",
    estimatedMinutes: 20,
    isCompleted: false,
    activityId: medicalFreeAnswer.id,
  },
];

const demoGoals: SubjectGoal[] = [
  { subjectId: "medical", targetGrade: 4, updatedAt: "2026-08-16T00:00:00.000Z" },
  { subjectId: "firearms", targetGrade: 5, updatedAt: "2026-08-16T00:00:00.000Z" },
];

type StoredMockState = {
  activityProgress: Record<string, number>;
  activityTouchedAt: Record<string, string>;
  results: AssessmentResult[];
  todayPlanCompletion: Record<string, boolean>;
  goals: Record<string, TargetGrade>;
  qualificationProfile: QualificationProfile | null;
  physicalProfile: PhysicalProfile | null;
  qualificationExamResults: QualificationExamResult[];
  practiceResults: PracticeResult[];
};

const emptyMockState: StoredMockState = {
  activityProgress: {},
  activityTouchedAt: {},
  results: [],
  todayPlanCompletion: {},
  goals: {},
  qualificationProfile: null,
  physicalProfile: null,
  qualificationExamResults: [],
  practiceResults: [],
};

function mockStateKey(userId: string) {
  return `motivator:learning:${userId}`;
}

function readMockState(userId: string): StoredMockState {
  if (typeof window === "undefined") return clone(emptyMockState);

  try {
    const raw = window.localStorage.getItem(mockStateKey(userId));
    if (!raw) return clone(emptyMockState);
    const parsed = JSON.parse(raw) as Partial<StoredMockState>;
    const qualificationProfile = parsed.qualificationProfile ?? null;
    if (qualificationProfile && !isAllowedQualificationTarget(
      qualificationProfile.currentQualification,
      qualificationProfile.targetQualification,
      qualificationProfile.serviceType,
    )) {
      qualificationProfile.targetQualification = getNextQualificationLevel(
        qualificationProfile.currentQualification,
        qualificationProfile.serviceType,
      );
    }
    return {
      activityProgress: parsed.activityProgress ?? {},
      activityTouchedAt: parsed.activityTouchedAt ?? {},
      results: parsed.results ?? [],
      todayPlanCompletion: parsed.todayPlanCompletion ?? {},
      goals: parsed.goals ?? {},
      qualificationProfile,
      physicalProfile: parsed.physicalProfile ?? null,
      qualificationExamResults: parsed.qualificationExamResults ?? [],
      practiceResults: parsed.practiceResults ?? [],
    };
  } catch {
    return clone(emptyMockState);
  }
}

function writeMockState(userId: string, state: StoredMockState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(mockStateKey(userId), JSON.stringify(state));
  }
}

function progressStatus(progressPercent: number): ProgressStatus {
  if (progressPercent >= 100) return "completed";
  if (progressPercent > 0) return "in_progress";
  return "not_started";
}

function subjectsForUser(userId?: string): Subject[] {
  const userSubjects = clone(subjects);
  if (!userId) return userSubjects;

  const state = readMockState(userId);
  for (const subject of userSubjects) {
    let subjectDelta = 0;

    for (const module of subject.modules) {
      const hasOverride = module.activities.some(
        (activity) => state.activityProgress[activity.id] !== undefined,
      );
      if (!hasOverride || module.activities.length === 0) continue;

      const nextProgress = Math.round(
        module.activities.reduce(
          (sum, activity) => sum + (state.activityProgress[activity.id] ?? module.progressPercent),
          0,
        ) / module.activities.length,
      );
      subjectDelta += nextProgress - module.progressPercent;
      module.progressPercent = nextProgress;
      module.status = progressStatus(nextProgress);
    }

    subject.progressPercent = Math.max(
      0,
      Math.min(100, Math.round(subject.progressPercent + subjectDelta / Math.max(1, subject.modules.length))),
    );
    subject.status = progressStatus(subject.progressPercent);

    const activityIds = new Set(
      subject.modules.flatMap((module) => module.activities.map((activity) => activity.id)),
    );
    const lastResult = state.results.find((result) => activityIds.has(result.activityId));
    if (lastResult) subject.lastScore = lastResult.score;
  }

  return userSubjects;
}

function findQuizActivity(activityId: string): QuizActivity | null {
  for (const subject of subjects) {
    for (const module of subject.modules) {
      const activity = module.activities.find(
        (item): item is QuizActivity => item.id === activityId && item.type === "quiz",
      );
      if (activity) return activity;
    }
  }
  return null;
}

function findFreeAnswerActivity(activityId: string): FreeAnswerActivity | null {
  for (const subject of subjects) {
    for (const module of subject.modules) {
      const activity = module.activities.find(
        (item): item is FreeAnswerActivity => item.id === activityId && item.type === "free_answer",
      );
      if (activity) return activity;
    }
  }
  return null;
}

function createResultId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}

function storeResult(userId: string, result: AssessmentResult) {
  const state = readMockState(userId);
  state.results = [result, ...state.results.filter((item) => item.id !== result.id)];
  state.activityProgress[result.activityId] = 100;
  state.activityTouchedAt[result.activityId] = result.completedAt;
  writeMockState(userId, state);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const mockLearningRepository: LearningRepository = {
  async getDashboard(userId = "demo-user") {
    const userSubjects = subjectsForUser(userId);
    const state = readMockState(userId);
    const userResults = userId === "demo-user" ? [...state.results, ...results] : state.results;
    const scores = userResults.map((result) => result.score).filter((score) => score > 0);
    const latestTouchedActivityId = Object.entries(state.activityTouchedAt)
      .reduce<[string, string] | null>((latest, entry) => {
        return !latest || entry[1] >= latest[1] ? entry : latest;
      }, null)?.[0];
    const latestStoredResult = state.results.reduce<AssessmentResult | null>((latest, result) => {
      return !latest || result.completedAt > latest.completedAt ? result : latest;
    }, null);
    const legacyProgressActivityId = Object.keys(state.activityProgress).at(-1);
    const latestDemoResult = userId === "demo-user"
      ? results.reduce<AssessmentResult | null>((latest, result) => {
          return !latest || result.completedAt > latest.completedAt ? result : latest;
        }, null)
      : null;
    const latestActivityId = latestTouchedActivityId ??
      legacyProgressActivityId ??
      latestStoredResult?.activityId ??
      latestDemoResult?.activityId;
    const latestContext = userSubjects.flatMap((subject) =>
      subject.modules.flatMap((module) =>
        module.activities
          .filter((activity) => activity.id === latestActivityId)
          .map((activity) => ({ subject, module, activity })),
      ),
    )[0] ?? null;
    const currentSubject = latestContext?.subject ??
      userSubjects.find((subject) => subject.status === "in_progress") ??
      null;
    const completedActivityIds = new Set(
      userResults
        .filter((result) => result.reviewStatus === "completed")
        .map((result) => result.activityId),
    );
    const findNextActivity = (module: LearningModule) => module.activities.find((activity) => {
      const fallbackProgress = module.progressPercent > 0 && activity.type === "theory" ? 100 : 0;
      return !completedActivityIds.has(activity.id) &&
        (state.activityProgress[activity.id] ?? fallbackProgress) < 100;
    }) ?? null;
    const latestModuleIndex = currentSubject && latestContext?.subject.id === currentSubject.id
      ? currentSubject.modules.findIndex((module) => module.id === latestContext.module.id)
      : -1;
    const moduleCandidates = currentSubject
      ? latestModuleIndex >= 0
        ? [
            ...currentSubject.modules.slice(latestModuleIndex),
            ...currentSubject.modules.slice(0, latestModuleIndex),
          ]
        : currentSubject.modules
      : [];
    const currentModule = moduleCandidates.find((module) => findNextActivity(module)) ??
      latestContext?.module ??
      null;
    const nextActivity = currentModule ? findNextActivity(currentModule) : null;
    const featuredSubjects = userSubjects
      .filter((subject) => subject.id !== currentSubject?.id && subject.status === "in_progress")
      .slice(0, 3);

    return clone({
      stats: {
        subjectsStarted: userSubjects.filter((subject) => subject.status !== "not_started").length,
        averageScore: scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0,
        quizzesCompleted: userResults.filter((result) => result.activityType === "quiz").length,
        needsReview: userResults.filter((result) => result.score > 0 && result.score < 70).length,
      },
      continueLearning: currentSubject && currentModule && nextActivity ? {
        subjectId: currentSubject.id,
        subjectTitle: currentSubject.title,
        subjectCode: currentSubject.title.charAt(0),
        moduleId: currentModule.id,
        moduleNumber: currentModule.number,
        modulesTotal: currentSubject.modules.length,
        moduleTitle: currentModule.title,
        nextActivityId: nextActivity.id,
        nextActivityType: nextActivity.type,
        nextActivityTitle: nextActivity.description ?? nextActivity.title,
        progressPercent: currentSubject.progressPercent,
      } : null,
      todayPlan: mockTodayPlan.map((item) => ({
        ...item,
        isCompleted: state.todayPlanCompletion[item.id] ?? item.isCompleted,
      })),
      featuredSubjects: featuredSubjects.length > 0 ? featuredSubjects : userSubjects.slice(0, 3),
    });
  },

  async getSubjects(userId) {
    return subjectsForUser(userId);
  },

  async getSubjectBySlug(slug, userId) {
    return subjectsForUser(userId).find((subject) => subject.slug === slug) ?? null;
  },

  async getModule(moduleId, userId) {
    for (const subject of subjectsForUser(userId)) {
      const module = subject.modules.find((item) => item.id === moduleId);
      if (module) return clone(module);
    }
    return null;
  },

  async getQuiz(activityId) {
    return clone(findQuizActivity(activityId));
  },

  async getFreeAnswer(activityId) {
    return clone(findFreeAnswerActivity(activityId));
  },

  async isFreeAnswerUnlocked(activityId, userId = "demo-user") {
    const activity = findFreeAnswerActivity(activityId);
    if (!activity) return false;

    const module = subjects
      .flatMap((subject) => subject.modules)
      .find((item) => item.id === activity.moduleId);
    const quizIds = module?.activities
      .filter((item) => item.type === "quiz")
      .map((item) => item.id) ?? [];
    if (quizIds.length === 0) return false;

    const completedQuizIds = new Set(
      (await this.getResults(userId))
        .filter((result) => result.activityType === "quiz" && result.reviewStatus === "completed")
        .map((result) => result.activityId),
    );
    return quizIds.every((quizId) => completedQuizIds.has(quizId));
  },

  async getResults(userId = "demo-user") {
    const storedResults = readMockState(userId).results;
    return clone(userId === "demo-user" ? [...storedResults, ...results] : storedResults);
  },

  async getResult(attemptId, userId = "demo-user") {
    const allResults = userId === "demo-user"
      ? [...readMockState(userId).results, ...results]
      : readMockState(userId).results;
    return clone(allResults.find((result) => result.id === attemptId) ?? null);
  },

  async submitQuiz(activityId, answers, userId = "demo-user") {
    const activity = findQuizActivity(activityId);
    if (!activity) throw new Error("Тест не найден.");
    if (activity.questions.some((question) => !answers[question.id])) {
      throw new Error("Ответьте на все вопросы перед отправкой теста.");
    }

    const correctAnswers = activity.questions.filter((question) => {
      return answers[question.id] === correctOptionByQuestionId.get(question.id);
    }).length;
    const score = Math.round(correctAnswers * 100 / Math.max(1, activity.questions.length));
    const result: AssessmentResult = {
      id: createResultId("quiz"),
      activityId,
      activityType: "quiz",
      reviewStatus: "completed",
      score,
      statusLabel:
        score >= 90 ? "Отличный результат" :
        score >= 75 ? "Хороший результат" :
        score >= 60 ? "Тест пройден" :
        "Нужно повторить тему",
      summary: `Правильных ответов: ${correctAnswers} из ${activity.questions.length}.`,
      submittedAnswer: null,
      criterionScores: [],
      aiFeedback: null,
      completedAt: new Date().toISOString(),
    };
    storeResult(userId, result);
    return clone(result);
  },

  async submitFreeAnswer(activityId, answer, userId = "demo-user") {
    const activity = findFreeAnswerActivity(activityId);
    if (!activity) throw new Error("Задание со свободным ответом не найдено.");
    if (!(await this.isFreeAnswerUnlocked(activityId, userId))) {
      throw new Error("Сначала завершите тест модуля.");
    }

    const normalizedAnswer = answer.trim();
    if (normalizedAnswer.length < 20) {
      throw new Error("Добавьте больше деталей: минимум 20 символов.");
    }

    const review = await requestLocalFreeAnswerReview(activityId, normalizedAnswer);
    const reviewByCriterion = new Map(
      review.criterionScores.map((criterion) => [criterion.criterionId, criterion]),
    );
    const scores = activity.criteria.map((criterion) => {
      const reviewedCriterion = reviewByCriterion.get(criterion.id);
      if (!reviewedCriterion) {
        throw new Error(`GigaChat не вернул оценку по критерию «${criterion.title}».`);
      }
      return {
        criterionId: criterion.id,
        title: criterion.title,
        score: reviewedCriterion.score,
        feedback: reviewedCriterion.feedback,
      };
    });

    const result: AssessmentResult = {
      id: createResultId("free-answer"),
      activityId,
      activityType: "free_answer",
      reviewStatus: "completed",
      score: review.score,
      statusLabel:
        review.score >= 90 ? "Отличный результат" :
        review.score >= 75 ? "Хороший результат" :
        review.score >= 60 ? "Ответ принят" :
        "Нужно повторить материал",
      summary: review.summary,
      submittedAnswer: normalizedAnswer,
      criterionScores: scores,
      aiFeedback: review.feedback,
      completedAt: new Date().toISOString(),
    };
    storeResult(userId, result);
    return clone(result);
  },

  async requestFreeAnswerReview(attemptId, userId = "demo-user") {
    const result = await this.getResult(attemptId, userId);
    if (!result) throw new Error("Ответ для проверки не найден.");
    return result;
  },

  async startActivity(activityId, userId = "demo-user") {
    const activityExists = subjects.some((subject) => subject.modules.some((module) =>
      module.activities.some((activity) => activity.id === activityId),
    ));
    if (!activityExists) throw new Error("Учебная активность не найдена.");

    const state = readMockState(userId);
    state.activityProgress[activityId] = Math.max(1, state.activityProgress[activityId] ?? 0);
    state.activityTouchedAt[activityId] = new Date().toISOString();
    writeMockState(userId, state);
  },

  async completeTheory(activityId, userId = "demo-user") {
    const theoryExists = subjects.some((subject) => subject.modules.some((module) =>
      module.activities.some((activity) => activity.id === activityId && activity.type === "theory"),
    ));
    if (!theoryExists) throw new Error("Теоретический материал не найден.");

    const state = readMockState(userId);
    state.activityProgress[activityId] = 100;
    state.activityTouchedAt[activityId] = new Date().toISOString();
    writeMockState(userId, state);
  },

  async saveQuizProgress(activityId, answeredCount, totalQuestions, userId = "demo-user") {
    if (!findQuizActivity(activityId)) throw new Error("Тест не найден.");
    const state = readMockState(userId);
    state.activityProgress[activityId] = Math.min(
      99,
      Math.max(0, Math.round(answeredCount * 100 / Math.max(1, totalQuestions))),
    );
    state.activityTouchedAt[activityId] = new Date().toISOString();
    writeMockState(userId, state);
  },

  async setTodayPlanItemCompleted(itemId, isCompleted, userId = "demo-user") {
    if (!mockTodayPlan.some((item) => item.id === itemId)) {
      throw new Error("Задача плана не найдена.");
    }
    const state = readMockState(userId);
    state.todayPlanCompletion[itemId] = isCompleted;
    writeMockState(userId, state);
  },

  async getGoals(userId = "demo-user") {
    const state = readMockState(userId);
    const baseGoals = userId === "demo-user" ? demoGoals : [];
    const goalsBySubject = new Map(baseGoals.map((goal) => [goal.subjectId, goal]));
    for (const [subjectId, targetGrade] of Object.entries(state.goals)) {
      goalsBySubject.set(subjectId, {
        subjectId,
        targetGrade,
        updatedAt: new Date().toISOString(),
      });
    }
    return clone([...goalsBySubject.values()]);
  },

  async setGoal(subjectId, targetGrade, userId = "demo-user") {
    if (!subjects.some((subject) => subject.id === subjectId)) {
      throw new Error("Предмет не найден.");
    }
    const state = readMockState(userId);
    state.goals[subjectId] = targetGrade;
    writeMockState(userId, state);
    return {
      subjectId,
      targetGrade,
      updatedAt: new Date().toISOString(),
    };
  },

  async saveFreeAnswerDraft(activityId, answer, userId = "demo-user") {
    if (!(await this.isFreeAnswerUnlocked(activityId, userId))) {
      throw new Error("Сначала завершите тест модуля.");
    }
    drafts.set(`${userId}:${activityId}`, answer);
    const state = readMockState(userId);
    state.activityTouchedAt[activityId] = new Date().toISOString();
    writeMockState(userId, state);
    return {
      activityId,
      answer,
      updatedAt: new Date().toISOString(),
    };
  },

  async getQualificationProfile(userId = "demo-user") {
    return clone(readMockState(userId).qualificationProfile);
  },

  async saveQualificationProfile(input, userId = "demo-user") {
    if (!input.isActiveServiceMember) {
      throw new Error("Приложение предназначено только для действующих военнослужащих.");
    }
    if (input.serviceType === "conscript" && input.targetQualification === "master") {
      throw new Error("Для службы по призыву цель «Мастер» не предусмотрена.");
    }
    if (!isAllowedQualificationTarget(
      input.currentQualification,
      input.targetQualification,
      input.serviceType,
    )) {
      throw new Error("Можно подтвердить текущую классность или выбрать следующий последовательный класс.");
    }
    if (!input.serviceStartedAt) throw new Error("Укажите дату начала службы.");

    const now = new Date().toISOString();
    const profile: QualificationProfile = {
      ...input,
      userId,
      policyVersion: QUALIFICATION_POLICY_VERSION,
      onboardingCompletedAt: now,
      activeServiceConfirmedAt: now,
      updatedAt: now,
    };
    const state = readMockState(userId);
    state.qualificationProfile = profile;
    writeMockState(userId, state);
    return clone(profile);
  },

  async getPhysicalProfile(userId = "demo-user") {
    return clone(readMockState(userId).physicalProfile);
  },

  async savePhysicalProfile(input, userId = "demo-user") {
    const age = calculateAge(input.birthDate);
    if (age === null || age < 18) {
      throw new Error("Укажите корректную дату рождения военнослужащего старше 18 лет.");
    }
    const profile: PhysicalProfile = {
      ...input,
      userId,
      policyVersion: PHYSICAL_POLICY_VERSION,
      updatedAt: new Date().toISOString(),
    };
    const state = readMockState(userId);
    state.physicalProfile = profile;
    writeMockState(userId, state);
    return clone(profile);
  },

  async getQualificationRoadmap(userId = "demo-user") {
    const state = readMockState(userId);
    return buildQualificationRoadmap({
      profile: state.qualificationProfile,
      physicalProfile: state.physicalProfile,
      subjects: subjectsForUser(userId),
      practiceResults: state.practiceResults,
      examResults: state.qualificationExamResults,
    });
  },

  async createQualificationExam(subjectIds, userId = "demo-user") {
    const uniqueSubjectIds = [...new Set(subjectIds)];
    if (uniqueSubjectIds.length < 4) {
      throw new Error("Для пробного испытания выберите не менее четырёх предметов.");
    }
    const state = readMockState(userId);
    if (!state.qualificationProfile) {
      throw new Error("Сначала настройте персональный маршрут.");
    }

    const examSubjects = uniqueSubjectIds.map((subjectId) => {
      const subject = subjectsForUser(userId).find((item) => item.id === subjectId);
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
      targetQualification: state.qualificationProfile.targetQualification,
      subjects: examSubjects,
      questionsPerSubject: 10,
      startedAt: new Date().toISOString(),
    };
  },

  async submitQualificationExam(exam, answers, userId = "demo-user") {
    const state = readMockState(userId);
    const profile = state.qualificationProfile;
    if (!profile) throw new Error("Сначала настройте персональный маршрут.");

    const subjectResults = exam.subjects.map((subject) => {
      if (subject.questions.some((question) => !answers[question.id])) {
        throw new Error(`Ответьте на все вопросы предмета «${subject.subjectTitle}».`);
      }
      const correctAnswers = subject.questions.filter((question) =>
        answers[question.id] === correctOptionByQuestionId.get(question.id)
      ).length;
      const scorePercent = Math.round(correctAnswers * 100 / subject.questions.length);
      return {
        subjectId: subject.subjectId,
        subjectTitle: subject.subjectTitle,
        correctAnswers,
        totalQuestions: subject.questions.length,
        scorePercent,
        grade: gradeQualificationTest(correctAnswers, subject.questions.length),
      };
    });
    const latestPhysical = [...state.practiceResults]
      .filter((result) => result.category === "physical")
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))[0];
    const physicalGrade = state.physicalProfile
      ? assessPhysicalResults(state.physicalProfile, profile.serviceType, state.practiceResults).grade
      : latestPhysical?.grade ?? null;
    const result = buildQualificationExamResult({
      id: createResultId("qualification-exam"),
      targetQualification: profile.targetQualification,
      physicalGrade,
      serviceType: profile.serviceType,
      subjectResults,
    });
    state.qualificationExamResults = [result, ...state.qualificationExamResults];
    writeMockState(userId, state);
    return clone(result);
  },

  async getQualificationExamResult(attemptId, userId = "demo-user") {
    return clone(
      readMockState(userId).qualificationExamResults.find((result) => result.id === attemptId) ?? null,
    );
  },

  async getPracticeResults(userId = "demo-user") {
    return clone(
      [...readMockState(userId).practiceResults].sort(
        (left, right) => right.performedAt.localeCompare(left.performedAt),
      ),
    );
  },

  async getPhysicalTrainingAdvice(userId = "demo-user") {
    const latest = [...readMockState(userId).practiceResults]
      .filter((result) => result.category === "physical")
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))[0];
    if (!latest) return null;

    const recommendations = latest.grade >= 4
      ? [
          "Сохраняйте регулярность и фиксируйте результат в одинаковых условиях.",
          "Повышайте нагрузку постепенно, контролируя восстановление.",
        ]
      : [
          "Разделите подготовку на короткие регулярные тренировки.",
          "Сначала улучшайте технику выполнения, затем увеличивайте объём.",
          "Повторите замер после восстановительного периода.",
        ];
    const advice: PhysicalTrainingAdvice = {
      id: `demo-advice-${latest.id}`,
      userId,
      basedOnResultId: latest.id,
      summary: `Демо-анализ результата «${latest.title}»: самостоятельная оценка ${latest.grade}.`,
      recommendations,
      caution: "Это общая учебная рекомендация, а не медицинское заключение или официальный план подготовки.",
      source: "demo_algorithm",
      generatedAt: latest.updatedAt,
    };
    return clone(advice);
  },

  async requestPhysicalTrainingAdvice(resultId, userId = "demo-user") {
    const result = readMockState(userId).practiceResults.find((item) => item.id === resultId);
    if (!result || result.category !== "physical") {
      throw new Error("Результат физической подготовки не найден.");
    }
    return this.getPhysicalTrainingAdvice(userId);
  },

  async savePracticeResult(input, userId = "demo-user") {
    if (!input.title.trim()) throw new Error("Укажите название норматива или упражнения.");
    if (!Number.isFinite(input.value) || input.value < 0) {
      throw new Error("Укажите корректный результат.");
    }
    if (input.category === "physical" && (
      !input.physicalExerciseId || !input.physicalQuality || input.points === null || input.points === undefined
    )) {
      throw new Error("Для физической подготовки выберите упражнение и рассчитайте баллы.");
    }
    const now = new Date().toISOString();
    const result: PracticeResult = {
      ...input,
      title: input.title.trim(),
      unit: input.unit.trim(),
      notes: input.notes?.trim() || null,
      id: createResultId("practice"),
      userId,
      source: "self_reported",
      createdAt: now,
      updatedAt: now,
    };
    const state = readMockState(userId);
    state.practiceResults = [result, ...state.practiceResults];
    writeMockState(userId, state);
    return clone(result);
  },

  async deletePracticeResult(resultId, userId = "demo-user") {
    const state = readMockState(userId);
    const nextResults = state.practiceResults.filter((result) => result.id !== resultId);
    if (nextResults.length === state.practiceResults.length) {
      throw new Error("Результат не найден.");
    }
    state.practiceResults = nextResults;
    writeMockState(userId, state);
  },
};
