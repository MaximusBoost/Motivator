import type {
  AssessmentResult,
  FreeAnswerActivity,
  LearningActivity,
  LearningModule,
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
  QUALIFICATION_POLICY_VERSION,
  reachesQualification,
} from "~/data/qualification-policy";
import type { LearningRepository } from "./learning.repository";

const optionTexts = [
  "Сначала оценить условия, риски и исходные данные",
  "Сразу перейти к действию без предварительной оценки",
  "Начать с оформления результата независимо от ситуации",
  "Ориентироваться только на скорость выполнения",
];

const questionPrompts = [
  "С чего следует начинать оценку новой ситуации?",
  "Что необходимо определить после сбора исходных данных?",
  "Как проверить выбранную последовательность действий?",
  "Какой принцип должен быть приоритетным перед выполнением любых действий в новой ситуации?",
  "Что важнее при выборе приоритета?",
  "Когда следует переходить к практическому действию?",
  "Для чего анализируются ограничения ситуации?",
  "Каким должен быть обоснованный вывод?",
  "Что помогает обнаружить слабые места решения?",
  "Как выглядит правильная последовательность принятия решения?",
];

const medicalQuizQuestions: QuizQuestion[] = questionPrompts.map((prompt, index) => ({
  id: `medical-m4-q${index + 1}`,
  prompt,
  instructions: "Выберите один вариант.",
  hint:
    index === 3
      ? "Сопоставьте каждый вариант с условием вопроса. Не выбирайте ответ только потому, что он звучит наиболее решительно."
      : "Сверьте вариант с алгоритмом: оценка, приоритет, действие, проверка.",
  position: index + 1,
  options: optionTexts.map((text, optionIndex) => ({
    id: `medical-m4-q${index + 1}-o${optionIndex + 1}`,
    label: String.fromCharCode(65 + optionIndex),
    text,
  })),
}));

const medicalQuiz: QuizActivity = {
  id: "medical-m4-quiz",
  moduleId: "medical-m4",
  type: "quiz",
  title: "Проверка знаний",
  description: "Тест: первичная оценка состояния",
  position: 2,
  estimatedMinutes: 15,
  questions: medicalQuizQuestions,
};

const medicalFreeAnswer: FreeAnswerActivity = {
  id: "medical-m4-free-answer-1",
  moduleId: "medical-m4",
  type: "free_answer",
  title: "Развернутый ответ",
  description: "Задание 1 из 2",
  position: 3,
  estimatedMinutes: 20,
  prompt: "Опишите, как вы будете оценивать ситуацию перед выбором дальнейшего действия.",
  instructions:
    "Ответьте своими словами. Важны логика, полнота и корректное использование понятий.",
  maxLength: 2000,
  criteria: [
    { id: "criterion-completeness", title: "Полнота ответа", weightPercent: 40, position: 1 },
    { id: "criterion-logic", title: "Логика изложения", weightPercent: 30, position: 2 },
    { id: "criterion-terms", title: "Ключевые понятия", weightPercent: 30, position: 3 },
  ],
};

function createGenericQuestions(activityId: string): QuizQuestion[] {
  return [1, 2, 3].map((position) => ({
    id: `${activityId}-q${position}`,
    prompt:
      position === 1
        ? "Какой шаг алгоритма выполняется первым?"
        : "Что необходимо сделать перед переходом к следующему этапу?",
    instructions: "Выберите один вариант.",
    hint: "Вспомните последовательность действий из теоретической части.",
    position,
    options: optionTexts.map((text, optionIndex) => ({
      id: `${activityId}-q${position}-o${optionIndex + 1}`,
      label: String.fromCharCode(65 + optionIndex),
      text,
    })),
  }));
}

function createActivities(moduleId: string): LearningActivity[] {
  const quizId = `${moduleId}-quiz`;

  return [
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
      title: "Проверка знаний",
      description: "Тест по материалам модуля",
      position: 2,
      estimatedMinutes: 15,
      questions: createGenericQuestions(quizId),
    },
  ];
}

function createModule(
  subjectId: string,
  number: number,
  title: string,
  status: ProgressStatus = "not_started",
  progressPercent = 0,
  summary = "Теория + тест",
): LearningModule {
  const id = `${subjectId}-m${number}`;

  return {
    id,
    subjectId,
    number,
    title,
    summary,
    estimatedMinutes: 25,
    objective: null,
    keyPrinciple: null,
    shortSummary: null,
    learningTip: null,
    sections: [],
    activities: createActivities(id),
    status,
    progressPercent,
  };
}

function withFreeAnswer(module: LearningModule, prompt: string): LearningModule {
  const activityId = `${module.id}-free-answer`;

  return {
    ...module,
    activities: [
      ...module.activities,
      {
        id: activityId,
        moduleId: module.id,
        type: "free_answer",
        title: "Развернутый ответ",
        description: "Практическое задание",
        position: 3,
        estimatedMinutes: 20,
        prompt,
        instructions:
          "Ответьте своими словами. Важны логика, полнота и корректное использование понятий.",
        maxLength: 2000,
        criteria: [
          {
            id: `${activityId}-completeness`,
            title: "Полнота ответа",
            weightPercent: 40,
            position: 1,
          },
          {
            id: `${activityId}-logic`,
            title: "Логика изложения",
            weightPercent: 30,
            position: 2,
          },
          {
            id: `${activityId}-terms`,
            title: "Ключевые понятия",
            weightPercent: 30,
            position: 3,
          },
        ],
      },
    ],
  };
}

const medicalModules: LearningModule[] = [
  createModule("medical", 1, "Основы предмета", "completed", 100),
  createModule("medical", 2, "Безопасность и базовые алгоритмы", "completed", 100),
  createModule("medical", 3, "Ключевые действия и последовательность", "completed", 100),
  {
    ...createModule(
      "medical",
      4,
      "Оценка ситуации и принятие решений",
      "in_progress",
      58,
      "Тест + свободный ответ",
    ),
    estimatedMinutes: 47,
    objective:
      "Научиться последовательно оценивать обстановку, выделять ключевые факторы и выбирать следующий шаг без потери контроля над ситуацией.",
    keyPrinciple: "Сначала оценка условий и рисков, затем — действие по алгоритму.",
    shortSummary: "Оценить → определить приоритет → выбрать действие → проверить решение.",
    learningTip:
      "После чтения ответьте на вопросы без возврата к тексту — это поможет точнее увидеть слабые места.",
    sections: [
      {
        id: "medical-m4-section-1",
        title: "1. Оцените исходные условия",
        body: "Перед началом действий определите, что уже известно, какие ограничения есть у ситуации и какие данные необходимо уточнить. Не переходите к следующему этапу, пока не сформировано ясное понимание исходной обстановки.",
        position: 1,
      },
      {
        id: "medical-m4-section-2",
        title: "2. Определите приоритет",
        body: "Сопоставьте полученную информацию с задачей модуля. Приоритет должен определяться значимостью фактора, а не только скоростью выполнения действия.",
        position: 2,
      },
      {
        id: "medical-m4-section-3",
        title: "3. Проверьте решение",
        body: "Перед переходом к практической части убедитесь, что выбранная последовательность логична, не противоречит условиям и может быть объяснена своими словами.",
        position: 3,
      },
    ],
    activities: [
      {
        id: "medical-m4-theory",
        moduleId: "medical-m4",
        type: "theory",
        title: "Теория",
        description: "Теоретический материал",
        position: 1,
        estimatedMinutes: 12,
      },
      medicalQuiz,
      medicalFreeAnswer,
      {
        ...medicalFreeAnswer,
        id: "medical-m4-free-answer-2",
        title: "Практический сценарий",
        description: "Задание 2 из 2",
        position: 4,
        prompt: "Обоснуйте выбранную последовательность действий в изменившихся условиях.",
      },
    ],
  },
  withFreeAnswer(
    createModule("medical", 5, "Практические сценарии"),
    "Опишите порядок действий в предложенном практическом сценарии.",
  ),
  createModule("medical", 6, "Закрепление материала", "not_started", 0, "Тест"),
  withFreeAnswer(
    createModule("medical", 7, "Комплексные алгоритмы"),
    "Составьте и обоснуйте комплексный алгоритм действий.",
  ),
  withFreeAnswer(
    createModule("medical", 8, "Итоговая проверка", "not_started", 0, "Итоговый тест"),
    "Подведите итог: какие факторы определяют выбор правильного действия?",
  ),
];

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
  const status: ProgressStatus =
    progressPercent === 0 ? "not_started" : progressPercent === 100 ? "completed" : "in_progress";

  return {
    id,
    code,
    slug,
    title,
    subtitle,
    theme,
    position,
    estimatedMinutes: moduleNames.length * 25,
    modules:
      id === "medical"
        ? medicalModules
        : moduleNames.map((name, index) => {
            const moduleProgress = Math.max(0, Math.min(100, progressPercent * 2 - index * 24));
            const moduleStatus: ProgressStatus =
              moduleProgress >= 100
                ? "completed"
                : moduleProgress > 0
                  ? "in_progress"
                  : "not_started";
            return createModule(id, index + 1, name, moduleStatus, moduleProgress);
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
    medicalModules.map((module) => module.title),
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

const results: AssessmentResult[] = [
  {
    id: "result-medical-free-answer-1",
    activityId: medicalFreeAnswer.id,
    activityType: "free_answer",
    score: 82,
    statusLabel: "Хороший результат",
    summary:
      "Ответ раскрывает основную логику задания. Для более высокого результата не хватает детализации в двух ключевых пунктах.",
    submittedAnswer:
      "Я сначала оцениваю исходные условия и ограничения, затем определяю наиболее значимый фактор и только после этого выбираю последовательность дальнейших действий.",
    criterionScores: [
      { criterionId: "criterion-completeness", title: "Полнота ответа", score: 85 },
      { criterionId: "criterion-logic", title: "Логика изложения", score: 78 },
      { criterionId: "criterion-terms", title: "Ключевые понятия", score: 82 },
    ],
    aiFeedback: {
      strength: "Последовательность рассуждения понятна и не содержит резких переходов.",
      improvement:
        "Добавьте явное объяснение, почему выбранный приоритет важнее альтернатив, и свяжите вывод с исходными условиями.",
      recommendation: "Повторить раздел «Оценка исходных условий».",
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
  results: AssessmentResult[];
  todayPlanCompletion: Record<string, boolean>;
  goals: Record<string, TargetGrade>;
  qualificationProfile: QualificationProfile | null;
  qualificationExamResults: QualificationExamResult[];
  practiceResults: PracticeResult[];
};

const emptyMockState: StoredMockState = {
  activityProgress: {},
  results: [],
  todayPlanCompletion: {},
  goals: {},
  qualificationProfile: null,
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
    return {
      activityProgress: parsed.activityProgress ?? {},
      results: parsed.results ?? [],
      todayPlanCompletion: parsed.todayPlanCompletion ?? {},
      goals: parsed.goals ?? {},
      qualificationProfile: parsed.qualificationProfile ?? null,
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
    const currentSubject = userSubjects.find((subject) => subject.status === "in_progress") ?? null;
    const currentModule = currentSubject?.modules.find((module) => module.status === "in_progress") ??
      currentSubject?.modules.find((module) => module.status === "not_started") ??
      null;
    const nextActivity = currentModule?.activities.find((activity) => {
      const fallbackProgress = currentModule.progressPercent > 0 && activity.type === "theory" ? 100 : 0;
      return (state.activityProgress[activity.id] ?? fallbackProgress) < 100;
    }) ?? null;
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
      const selectedOption = question.options.find((option) => option.id === answers[question.id]);
      return selectedOption?.label === "A";
    }).length;
    const score = Math.round(correctAnswers * 100 / Math.max(1, activity.questions.length));
    const result: AssessmentResult = {
      id: createResultId("quiz"),
      activityId,
      activityType: "quiz",
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

    const normalized = answer.trim().toLocaleLowerCase("ru");
    if (normalized.length < 20) throw new Error("Добавьте больше деталей: минимум 20 символов.");

    const completeness = Math.min(100, Math.max(45, Math.round(normalized.length / 4)));
    const logic = Math.min(100, 55 + (normalized.includes("затем") ? 18 : 0) + (normalized.includes("после") ? 12 : 0));
    const keywords = ["оцен", "услов", "риск", "приоритет", "действ", "проверк"];
    const keywordScore = keywords.filter((keyword) => normalized.includes(keyword)).length;
    const terms = Math.min(100, 45 + keywordScore * 9);
    const scores = activity.criteria.map((criterion) => ({
      criterionId: criterion.id,
      title: criterion.title,
      score: criterion.position === 1 ? completeness : criterion.position === 2 ? logic : terms,
    }));
    const score = Math.round(scores.reduce((total, item, index) => {
      const weight = activity.criteria[index]?.weightPercent ?? 0;
      return total + item.score * weight / 100;
    }, 0));

    const result: AssessmentResult = {
      id: createResultId("free-answer"),
      activityId,
      activityType: "free_answer",
      score,
      statusLabel: "Предварительный результат",
      summary: "В demo-режиме выполнена локальная проверка структуры и ключевых понятий. После подключения ИИ результат будет формироваться на сервере.",
      submittedAnswer: answer.trim(),
      criterionScores: scores,
      aiFeedback: null,
      completedAt: new Date().toISOString(),
    };
    storeResult(userId, result);
    return clone(result);
  },

  async completeTheory(activityId, userId = "demo-user") {
    const theoryExists = subjects.some((subject) => subject.modules.some((module) =>
      module.activities.some((activity) => activity.id === activityId && activity.type === "theory"),
    ));
    if (!theoryExists) throw new Error("Теоретический материал не найден.");

    const state = readMockState(userId);
    state.activityProgress[activityId] = 100;
    writeMockState(userId, state);
  },

  async saveQuizProgress(activityId, answeredCount, totalQuestions, userId = "demo-user") {
    if (!findQuizActivity(activityId)) throw new Error("Тест не найден.");
    const state = readMockState(userId);
    state.activityProgress[activityId] = Math.min(
      99,
      Math.max(0, Math.round(answeredCount * 100 / Math.max(1, totalQuestions))),
    );
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
    drafts.set(`${userId}:${activityId}`, answer);
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
    if (
      input.currentQualification !== input.targetQualification &&
      reachesQualification(input.currentQualification, input.targetQualification)
    ) {
      throw new Error("Целевая классность не может быть ниже текущей.");
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

  async getQualificationRoadmap(userId = "demo-user") {
    const state = readMockState(userId);
    return buildQualificationRoadmap({
      profile: state.qualificationProfile,
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
        question.options.find((option) => option.id === answers[question.id])?.label === "A"
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
    const physicalGrade = [...state.practiceResults]
      .filter((result) => result.category === "physical")
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))[0]?.grade ?? null;
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

  async savePracticeResult(input, userId = "demo-user") {
    if (!input.title.trim()) throw new Error("Укажите название норматива или упражнения.");
    if (!Number.isFinite(input.value) || input.value < 0) {
      throw new Error("Укажите корректный результат.");
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
