import type {
  AssessmentResult,
  FreeAnswerActivity,
  LearningActivity,
  LearningModule,
  ProgressStatus,
  QuizActivity,
  QuizQuestion,
  Subject,
} from "~/data/types";
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
  return [1, 2].map((position) => ({
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const mockLearningRepository: LearningRepository = {
  async getDashboard() {
    return clone({
      stats: {
        subjectsStarted: 7,
        averageScore: 68,
        quizzesCompleted: 12,
        needsReview: 3,
      },
      continueLearning: {
        subjectId: "medical",
        subjectTitle: "Медицинская подготовка",
        subjectCode: "М",
        moduleId: "medical-m4",
        moduleNumber: 4,
        modulesTotal: 8,
        moduleTitle: "Первая помощь",
        nextActivityId: medicalQuiz.id,
        nextActivityTitle: "Тест: первичная оценка состояния",
        progressPercent: 62,
      },
      todayPlan: [
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
      ],
      featuredSubjects: [subjects[1], subjects[2], subjects[4]],
    });
  },

  async getSubjects() {
    return clone(subjects);
  },

  async getSubjectBySlug(slug) {
    return clone(subjects.find((subject) => subject.slug === slug) ?? null);
  },

  async getModule(moduleId) {
    for (const subject of subjects) {
      const module = subject.modules.find((item) => item.id === moduleId);
      if (module) return clone(module);
    }
    return null;
  },

  async getQuiz(activityId) {
    for (const subject of subjects) {
      for (const module of subject.modules) {
        const activity = module.activities.find(
          (item): item is QuizActivity => item.id === activityId && item.type === "quiz",
        );
        if (activity) return clone(activity);
      }
    }
    return null;
  },

  async getFreeAnswer(activityId) {
    for (const subject of subjects) {
      for (const module of subject.modules) {
        const activity = module.activities.find(
          (item): item is FreeAnswerActivity =>
            item.id === activityId && item.type === "free_answer",
        );
        if (activity) return clone(activity);
      }
    }
    return null;
  },

  async getResults() {
    return clone(results);
  },

  async saveFreeAnswerDraft(activityId, answer, userId = "demo-user") {
    drafts.set(`${userId}:${activityId}`, answer);
    return {
      activityId,
      answer,
      updatedAt: new Date().toISOString(),
    };
  },
};
