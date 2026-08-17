import type {
  PhysicalAssessmentCategory,
  PhysicalAssessmentSummary,
  PhysicalExerciseId,
  PhysicalProfile,
  PhysicalQuality,
  PhysicalQualificationLevel,
  PhysicalSex,
  PhysicalTrainingProgram,
  PracticeResult,
  ServiceType,
  TargetGrade,
} from "~/data/types";

export const PHYSICAL_POLICY_VERSION = "mo-230:2025-12-08";
export const PHYSICAL_POLICY_SOURCE =
  "Приказ Министра обороны РФ от 20.04.2023 № 230 (ред. от 08.12.2025)";

export const physicalQualificationLabels: Record<PhysicalQualificationLevel, string> = {
  third: "Третий квалификационный уровень",
  second: "Второй квалификационный уровень",
  first: "Первый квалификационный уровень",
  highest: "Высший квалификационный уровень",
};

export const physicalQualityLabels: Record<PhysicalQuality, string> = {
  strength: "Сила",
  speed: "Быстрота",
  endurance: "Выносливость",
};

export const physicalBonusPercent: Record<PhysicalQualificationLevel, number> = {
  third: 0,
  second: 15,
  first: 30,
  highest: 70,
};

export type PhysicalExerciseDefinition = {
  id: PhysicalExerciseId;
  title: string;
  shortTitle: string;
  quality: PhysicalQuality;
  resultKind: "repetitions" | "seconds" | "time";
  unit: string;
  placeholder: string;
  inputHint: string;
};

export const physicalExercises: PhysicalExerciseDefinition[] = [
  {
    id: "push_ups",
    title: "Упражнение № 1 — сгибание и разгибание рук в упоре лёжа",
    shortTitle: "Отжимания",
    quality: "strength",
    resultKind: "repetitions",
    unit: "раз",
    placeholder: "Например, 32",
    inputHint: "Введите целое количество засчитанных повторений.",
  },
  {
    id: "pull_ups",
    title: "Упражнение № 3 — подтягивание на перекладине",
    shortTitle: "Подтягивания",
    quality: "strength",
    resultKind: "repetitions",
    unit: "раз",
    placeholder: "Например, 12",
    inputHint: "Введите целое количество засчитанных повторений.",
  },
  {
    id: "run_100m",
    title: "Упражнение № 18 — бег на 100 м",
    shortTitle: "Бег 100 м",
    quality: "speed",
    resultKind: "seconds",
    unit: "с",
    placeholder: "Например, 14,2",
    inputHint: "Введите секунды с точностью до десятых: 14,2.",
  },
  {
    id: "run_1km",
    title: "Упражнение № 24 — бег на 1 км",
    shortTitle: "Бег 1 км",
    quality: "endurance",
    resultKind: "time",
    unit: "с",
    placeholder: "Например, 3:45",
    inputHint: "Введите время в формате минуты:секунды, например 3:45.",
  },
];

type TimedThreshold = readonly [seconds: number, points: number];

function rangeDescending(start: number, end: number): number[] {
  return Array.from({ length: start - end + 1 }, (_, index) => start - index);
}

function oddRangeDescending(start: number, end: number): number[] {
  return rangeDescending(start, end).filter((value) => value % 2 === 1);
}

const run100Under35: TimedThreshold[] = [
  [12, 100], [12.1, 98], [12.2, 96], [12.3, 94], [12.4, 92], [12.5, 90],
  [12.6, 88], [12.7, 86], [12.8, 84], [12.9, 82], [13, 80], [13.1, 78],
  [13.2, 76], [13.3, 73], [13.4, 70], [13.5, 67], [13.6, 64], [13.7, 61],
  [13.8, 58], [13.9, 55], [14, 52], [14.1, 50], [14.2, 48], [14.3, 46],
  [14.4, 44], [14.5, 42], [14.6, 40], [14.7, 38], [14.8, 36], [14.9, 35],
  [15, 34], [15.1, 33], [15.2, 32], [15.3, 31], [15.4, 30], [15.5, 29],
  [15.6, 28], [15.7, 27], [15.8, 26], [15.9, 25], [16, 24], [16.1, 23],
  [16.3, 22], [16.5, 21], [16.7, 20], [16.9, 19], [17.1, 18], [17.3, 17],
  [17.5, 16], [17.6, 15], [17.7, 14], [17.8, 13], [18, 12], [18.1, 11],
  [18.2, 10], [18.3, 9], [18.4, 8], [18.6, 7], [18.8, 6], [19, 5],
  [19.2, 4], [19.4, 3], [19.6, 2],
];

const run100Over35: TimedThreshold[] = [
  [13, 100], [13.1, 98], [13.2, 96], [13.3, 94], [13.4, 92], [13.5, 90],
  [13.6, 88], [13.7, 86], [13.8, 84], [13.9, 82], [14, 80], [14.1, 76],
  [14.2, 72], [14.3, 68], [14.4, 64], [14.5, 60], [14.6, 56], [14.7, 52],
  [14.8, 48], [14.9, 45], [15, 42], [15.1, 41], [15.2, 40], [15.3, 39],
  [15.4, 38], [15.5, 37], [15.6, 36], [15.7, 35], [15.8, 34], [15.9, 33],
  [16, 32], [16.1, 31], [16.2, 30], [16.3, 29], [16.4, 28], [16.5, 27],
  [16.6, 26], [16.7, 25], [16.8, 24], [16.9, 23], [17, 22], [17.2, 21],
  [17.4, 20], [17.6, 19], [17.8, 18], [18, 17], [18.2, 16], [18.4, 15],
  [18.6, 14], [18.8, 13], [19, 12], [19.1, 11], [19.2, 10], [19.3, 9],
  [19.4, 8], [19.6, 7], [19.8, 6], [20, 5], [20.2, 4], [20.4, 3], [20.6, 2],
];

const run1kUnder35: TimedThreshold[] = [
  ...rangeDescending(100, 91).map((points) => [195 + (100 - points), points] as const),
  ...oddRangeDescending(89, 59).map((points) => [205 + (89 - points) / 2, points] as const),
  ...oddRangeDescending(57, 41).map((points) => [221 + (57 - points) / 2, points] as const),
  ...rangeDescending(40, 30).map((points) => [230 + (40 - points), points] as const),
  ...rangeDescending(29, 18).map((points) => [245 + (29 - points) * 5, points] as const),
  ...rangeDescending(17, 2).map((points) => [310 + (17 - points) * 5, points] as const),
];

const run1kOver35: TimedThreshold[] = [
  ...rangeDescending(100, 91).map((points) => [205 + (100 - points), points] as const),
  ...oddRangeDescending(89, 61).map((points) => [215 + (89 - points) / 2, points] as const),
  ...rangeDescending(60, 50).map((points) => [230 + (60 - points), points] as const),
  ...rangeDescending(49, 25).map((points) => [242 + (49 - points) * 2, points] as const),
  ...rangeDescending(24, 5).map((points) => [295 + (24 - points) * 5, points] as const),
  ...rangeDescending(4, 2).map((points) => [400 + (4 - points) * 10, points] as const),
];

const pullUpPoints: Record<number, number> = {
  1: 8, 2: 16, 3: 22, 4: 26, 5: 30, 6: 34, 7: 38, 8: 42, 9: 46, 10: 50,
  11: 54, 12: 58, 13: 62, 14: 66, 15: 70, 16: 72, 17: 74, 18: 76,
  19: 78, 20: 80, 21: 83, 22: 87, 23: 91, 24: 95, 25: 100,
};

type AssessmentThresholds = {
  minimum: number;
  requiredCount: number;
  grades: Record<3 | 4 | 5, number>;
  levels: Record<PhysicalQualificationLevel, number> | null;
};

const maleGradeThresholds = [
  [
    [210, 190, 140], [200, 180, 130], [190, 170, 120],
  ],
  [
    [200, 180, 130], [190, 170, 120], [180, 160, 110],
  ],
  [
    [190, 170, 120], [180, 160, 110], [170, 150, 100],
  ],
  [
    [170, 150, 100], [160, 140, 90], [150, 130, 80],
  ],
  [
    [150, 130, 90], [140, 120, 80], [130, 110, 70],
  ],
  [
    [130, 110, 80], [120, 100, 70], [100, 80, 60],
  ],
] as const;

const maleLevelThresholds = [
  [[250, 230, 220, 210], [240, 220, 210, 200], [230, 210, 200, 190]],
  [[240, 220, 210, 200], [230, 210, 200, 190], [220, 200, 190, 180]],
  [[230, 210, 200, 190], [220, 200, 190, 180], [210, 190, 180, 170]],
  [[210, 190, 180, 170], [200, 180, 170, 160], [190, 170, 160, 150]],
  [[180, 170, 160, 150], [170, 160, 150, 140], [160, 150, 140, 130]],
  [[160, 150, 140, 130], [150, 140, 130, 120], [130, 120, 110, 100]],
] as const;

const maleMinimums = [30, 28, 26, 22, 20, 16, 12, 10, 8] as const;
const olderMaleGrades = [[50, 40, 30], [40, 30, 20], [25, 20, 16]] as const;
const olderMaleLevels = [[70, 60, 55, 50], [55, 50, 45, 40], [40, 35, 30, 25]] as const;
const femaleMinimums = [8, 7, 6, 5, 4, 3, 2] as const;
const femaleGrades = [
  [80, 70, 40], [70, 60, 35], [60, 50, 30], [50, 40, 25],
  [40, 30, 20], [20, 15, 10], [15, 10, 5],
] as const;
const femaleLevels = [
  [95, 90, 85, 80], [85, 80, 75, 70], [75, 70, 65, 60], [65, 60, 55, 50],
  [55, 50, 45, 40], [35, 30, 25, 20], [30, 25, 20, 15],
] as const;
const maleSingleExerciseGrades = [
  [70, 50, 34], [68, 48, 32], [60, 40, 30], [55, 36, 26], [50, 30, 24],
  [40, 25, 18], [30, 20, 14], [20, 16, 12], [15, 12, 10],
] as const;
const femaleSingleExerciseGrades = [
  [22, 15, 9], [20, 14, 8], [18, 13, 7], [16, 12, 6],
  [14, 11, 5], [12, 9, 4], [10, 7, 3],
] as const;

function toGradeThresholds(values: readonly [number, number, number]): Record<3 | 4 | 5, number> {
  return { 5: values[0], 4: values[1], 3: values[2] };
}

function toLevelThresholds(
  values: readonly [number, number, number, number],
): Record<PhysicalQualificationLevel, number> {
  return { highest: values[0], first: values[1], second: values[2], third: values[3] };
}

export function calculateAge(birthDate: string, onDate = new Date()): number | null {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > onDate) return null;
  let age = onDate.getFullYear() - birth.getFullYear();
  const monthDifference = onDate.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && onDate.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function getPhysicalAgeGroup(sex: PhysicalSex, age: number): number {
  if (age < 25) return 1;
  if (age < 30) return 2;
  if (age < 35) return 3;
  if (age < 40) return 4;
  if (age < 45) return 5;
  if (age < 50) return 6;
  if (sex === "female" || age < 55) return 7;
  if (age < 60) return 8;
  return 9;
}

function getAssessmentThresholds(
  sex: PhysicalSex,
  ageGroup: number,
  category: PhysicalAssessmentCategory,
  serviceType: ServiceType,
): AssessmentThresholds {
  if (serviceType === "conscript") {
    return {
      minimum: 26,
      requiredCount: 3,
      grades: { 5: 170, 4: 150, 3: 120 },
      levels: null,
    };
  }

  if (sex === "female") {
    const index = Math.min(7, Math.max(1, ageGroup)) - 1;
    return {
      minimum: femaleMinimums[index],
      requiredCount: ageGroup >= 6 ? 2 : 3,
      grades: toGradeThresholds(femaleGrades[index]),
      levels: toLevelThresholds(femaleLevels[index]),
    };
  }

  const index = Math.min(9, Math.max(1, ageGroup)) - 1;
  if (ageGroup >= 7) {
    const olderIndex = index - 6;
    return {
      minimum: maleMinimums[index],
      requiredCount: 2,
      grades: toGradeThresholds(olderMaleGrades[olderIndex]),
      levels: toLevelThresholds(olderMaleLevels[olderIndex]),
    };
  }

  return {
    minimum: maleMinimums[index],
    requiredCount: 3,
    grades: toGradeThresholds(maleGradeThresholds[index][category - 1]),
    levels: toLevelThresholds(maleLevelThresholds[index][category - 1]),
  };
}

function getSingleExerciseGradeThresholds(
  sex: PhysicalSex,
  ageGroup: number,
  serviceType: ServiceType,
): Record<3 | 4 | 5, number> {
  if (serviceType === "conscript") return { 5: 60, 4: 40, 3: 30 };
  const source = sex === "female" ? femaleSingleExerciseGrades : maleSingleExerciseGrades;
  const index = Math.min(source.length, Math.max(1, ageGroup)) - 1;
  return toGradeThresholds(source[index]);
}

function pointsForRepetitions(exerciseId: PhysicalExerciseId, result: number): number {
  const repetitions = Math.floor(result);
  if (exerciseId === "push_ups") {
    if (repetitions >= 50) return 100;
    if (repetitions <= 0) return 0;
    if (repetitions <= 13) return repetitions === 1 ? 1 : repetitions * 2 - 2;
    if (repetitions === 14) return 27;
    if (repetitions === 15) return 30;
    return repetitions * 2;
  }
  if (repetitions >= 25) return 100;
  return pullUpPoints[repetitions] ?? 0;
}

function pointsForTimedResult(result: number, thresholds: TimedThreshold[]): number {
  if (!Number.isFinite(result) || result <= 0) return 0;
  return thresholds.find(([seconds]) => result <= seconds)?.[1] ?? 0;
}

export function parsePhysicalResult(exerciseId: PhysicalExerciseId, rawValue: string): number | null {
  const exercise = physicalExercises.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  const normalized = rawValue.trim().replace(",", ".");
  if (exercise.resultKind === "time") {
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(normalized);
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (exercise.resultKind === "repetitions" && !Number.isInteger(value)) return null;
  return value;
}

export function formatPhysicalResult(exerciseId: PhysicalExerciseId, value: number): string {
  const exercise = physicalExercises.find((item) => item.id === exerciseId);
  if (exercise?.resultKind !== "time") return `${value.toLocaleString("ru-RU")} ${exercise?.unit ?? ""}`.trim();
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function calculatePhysicalExerciseScore(input: {
  exerciseId: PhysicalExerciseId;
  resultValue: number;
  birthDate: string;
  sex: PhysicalSex;
  assessmentCategory: PhysicalAssessmentCategory;
  serviceType: ServiceType;
  performedAt?: string;
}): { points: number; grade: TargetGrade; age: number; ageGroup: number } {
  const onDate = input.performedAt ? new Date(`${input.performedAt}T00:00:00`) : new Date();
  const age = calculateAge(input.birthDate, onDate);
  if (age === null || age < 18) throw new Error("Укажите корректную дату рождения военнослужащего старше 18 лет.");
  const ageGroup = getPhysicalAgeGroup(input.sex, age);
  const isOver35 = age >= 35;
  const points = input.exerciseId === "push_ups" || input.exerciseId === "pull_ups"
    ? pointsForRepetitions(input.exerciseId, input.resultValue)
    : pointsForTimedResult(
        input.resultValue,
        input.exerciseId === "run_100m"
          ? (isOver35 ? run100Over35 : run100Under35)
          : (isOver35 ? run1kOver35 : run1kUnder35),
      );
  const gradeThresholds = getSingleExerciseGradeThresholds(input.sex, ageGroup, input.serviceType);
  const grade: TargetGrade = points >= gradeThresholds[5]
    ? 5
    : points >= gradeThresholds[4]
      ? 4
      : points >= gradeThresholds[3] ? 3 : 2;
  return { points, grade, age, ageGroup };
}

function latestByQuality(results: PracticeResult[]): Map<PhysicalQuality, PracticeResult> {
  const sorted = [...results]
    .filter((result) => result.category === "physical" && result.physicalQuality && result.points !== null && result.points !== undefined)
    .sort((left, right) =>
      right.performedAt.localeCompare(left.performedAt) || right.createdAt.localeCompare(left.createdAt),
    );
  const latest = new Map<PhysicalQuality, PracticeResult>();
  for (const result of sorted) {
    if (result.physicalQuality && !latest.has(result.physicalQuality)) latest.set(result.physicalQuality, result);
  }
  return latest;
}

export function assessPhysicalResults(
  profile: PhysicalProfile,
  serviceType: ServiceType,
  results: PracticeResult[],
): PhysicalAssessmentSummary {
  const age = calculateAge(profile.birthDate);
  if (age === null) throw new Error("В профиле физподготовки указана некорректная дата рождения.");
  const ageGroup = getPhysicalAgeGroup(profile.sex, age);
  const thresholds = getAssessmentThresholds(
    profile.sex,
    ageGroup,
    profile.assessmentCategory,
    serviceType,
  );
  const latest = latestByQuality(results);
  const qualities: PhysicalQuality[] = ["strength", "speed", "endurance"];
  const counted = qualities.map((quality) => latest.get(quality)).filter((result): result is PracticeResult => Boolean(result));
  const selected = counted.slice(0, thresholds.requiredCount);
  const sumPoints = selected.reduce((sum, result) => sum + (result.points ?? 0), 0);
  const missingQualities = qualities.filter((quality) => !latest.has(quality)).slice(
    0,
    Math.max(0, thresholds.requiredCount - counted.length),
  );
  const isComplete = selected.length >= thresholds.requiredCount;
  const meetsMinimum = isComplete && selected.every((result) => (result.points ?? 0) >= thresholds.minimum);

  let grade: TargetGrade | null = null;
  if (isComplete) {
    grade = !meetsMinimum
      ? 2
      : sumPoints >= thresholds.grades[5]
        ? 5
        : sumPoints >= thresholds.grades[4]
          ? 4
          : sumPoints >= thresholds.grades[3] ? 3 : 2;
  }

  let preliminaryLevel: PhysicalQualificationLevel | null = null;
  if (meetsMinimum && thresholds.levels) {
    preliminaryLevel = sumPoints >= thresholds.levels.highest
      ? "highest"
      : sumPoints >= thresholds.levels.first
        ? "first"
        : sumPoints >= thresholds.levels.second
          ? "second"
          : sumPoints >= thresholds.levels.third ? "third" : null;
  }

  const targetPoints = thresholds.levels?.[profile.targetLevel] ?? null;
  const rawProgress = targetPoints ? Math.round(sumPoints * 100 / targetPoints) : 0;
  const progressPercent = Math.max(0, Math.min(isComplete ? 100 : 90, rawProgress));

  return {
    grade,
    preliminaryLevel,
    sumPoints,
    requiredExerciseCount: thresholds.requiredCount,
    countedExerciseCount: selected.length,
    minimumPointsPerExercise: thresholds.minimum,
    missingQualities,
    progressPercent,
    targetPoints,
    isComplete,
  };
}

export function buildPhysicalTrainingProgram(
  profile: PhysicalProfile,
  assessment: PhysicalAssessmentSummary,
  results: PracticeResult[],
): PhysicalTrainingProgram {
  const latest = latestByQuality(results);
  const measuredQualities = [...latest.entries()].sort(
    (left, right) => (left[1].points ?? 0) - (right[1].points ?? 0),
  ).map(([quality]) => quality);
  const priorities = [...assessment.missingQualities, ...measuredQualities]
    .filter((quality, index, values) => values.indexOf(quality) === index);
  const primary = priorities[0] ?? "endurance";
  const ambitiousTarget = profile.targetLevel === "first" || profile.targetLevel === "highest";
  const needsBase = !assessment.isComplete || assessment.grade === 2;

  const sessions = needsBase
    ? [
        {
          day: "Понедельник",
          title: "Силовая техника",
          details: "Разминка 10 минут; 4–5 подходов выбранного силового упражнения по 50–60% от текущего максимума; упражнения на корпус; заминка.",
          intensity: "Без отказа, запас 3–4 повторения",
        },
        {
          day: "Среда",
          title: "Лёгкий бег и беговая азбука",
          details: "20–30 минут лёгкого бега или чередования бега с шагом; затем 4–6 специальных беговых упражнений по 30 м с полным восстановлением.",
          intensity: "Разговорный темп, RPE 3–4 из 10",
        },
        {
          day: "Суббота",
          title: "Контролируемая выносливость",
          details: "Разминка; 6 повторов по 2 минуты устойчивого бега через 2 минуты лёгкого движения; заминка 10 минут.",
          intensity: "Рабочие отрезки RPE 6–7 из 10",
        },
      ]
    : [
        {
          day: "Понедельник",
          title: "Сила",
          details: "5 подходов целевого упражнения по 60–70% от текущего максимума; после каждого подхода сохраняйте 2–3 повторения в запасе; добавьте тяговое и кор-упражнение.",
          intensity: "RPE 6–7 из 10, без отказа",
        },
        {
          day: "Вторник",
          title: "Скорость и техника бега",
          details: "Разминка 12–15 минут; беговая азбука; 6–8 ускорений по 60 м с полным восстановлением 2–3 минуты.",
          intensity: "Быстро, но технически чисто; не максимальный спринт",
        },
        {
          day: "Четверг",
          title: "Интервальная выносливость",
          details: "5–6 отрезков по 3 минуты в контролируемо тяжёлом темпе через 2 минуты лёгкого бега; заминка.",
          intensity: "RPE 7 из 10, одинаковый темп всех повторов",
        },
        {
          day: "Суббота",
          title: "Лёгкий длительный бег",
          details: `${ambitiousTarget ? "35–50" : "30–40"} минут лёгкого непрерывного бега; в конце 4 коротких расслабленных ускорения по 15–20 секунд.`,
          intensity: "Разговорный темп, RPE 3–4 из 10",
        },
      ];

  return {
    title: needsBase
      ? `Адаптационный цикл: приоритет «${physicalQualityLabels[primary]}»`
      : `Подготовка к цели «${physicalQualificationLabels[profile.targetLevel]}»`,
    durationWeeks: 6,
    rationale: assessment.isComplete
      ? `Программа начинает работу с наиболее слабого качества и ведёт от предварительной оценки ${assessment.grade ?? "—"} к целевому уровню без резкого скачка нагрузки.`
      : `Сначала нужно безопасно собрать базу и результаты по ${assessment.requiredExerciseCount} разным физическим качествам; после этого программа уточнится автоматически.`,
    weeklySessions: sessions,
    progression: [
      "Недели 1–2: освоить объём и стабильную технику.",
      "Неделя 3: увеличить только один параметр нагрузки на 5–10%.",
      "Неделя 4: снизить общий объём примерно на 25% для восстановления.",
      "Недели 5–6: вернуться к объёму третьей недели и выполнить контрольный замер после дня отдыха.",
    ],
    caution: "План — учебный шаблон, а не медицинское назначение. Выполняйте его только при допуске к нагрузкам; при боли, головокружении, необычной одышке или ухудшении самочувствия прекратите занятие и обратитесь к медицинскому специалисту.",
  };
}
