import type {
  PhysicalProfile,
  PracticeResult,
  QualificationExamResult,
  QualificationExamSubjectResult,
  QualificationLevel,
  QualificationProfile,
  QualificationRequirementProgress,
  QualificationRoadmap,
  QualificationSubjectReadiness,
  ServiceType,
  ServiceDirection,
  Subject,
  TargetGrade,
} from "~/data/types";
import {
  assessPhysicalResults,
  physicalBonusPercent,
} from "~/data/physical-training-policy";

export const QUALIFICATION_POLICY_VERSION = "mo-256:2025-02-11";
export const QUALIFICATION_POLICY_SOURCE =
  "Приказ Министра обороны РФ от 28.04.2022 № 256 (ред. от 11.02.2025)";

export const qualificationLabels: Record<QualificationLevel, string> = {
  none: "Без классной квалификации",
  third: "Специалист 3-го класса",
  second: "Специалист 2-го класса",
  first: "Специалист 1-го класса",
  master: "Мастер",
};

export const qualificationBonusPercent: Record<QualificationLevel, number> = {
  none: 0,
  third: 5,
  second: 10,
  first: 20,
  master: 30,
};

export const serviceDirectionLabels: Record<ServiceDirection, string> = {
  general: "Общевойсковое направление",
  command: "Командное направление",
  technical: "Инженерно-технический профиль",
  engineering: "Инженерная подготовка",
  communications: "Связь и автоматизированные системы",
  logistics: "Материально-техническое обеспечение",
  medical_support: "Медицинское обеспечение",
};

const qualificationRank: Record<QualificationLevel, number> = {
  none: 0,
  third: 1,
  second: 2,
  first: 3,
  master: 4,
};

export function getNextQualificationLevel(
  currentQualification: QualificationLevel,
  serviceType: ServiceType,
): Exclude<QualificationLevel, "none"> {
  if (currentQualification === "none") return "third";
  if (currentQualification === "third") return "second";
  if (currentQualification === "second") return "first";
  if (currentQualification === "first" && serviceType === "contract") return "master";
  return currentQualification;
}

export function isSequentialQualificationTarget(
  currentQualification: QualificationLevel,
  targetQualification: Exclude<QualificationLevel, "none">,
  serviceType: ServiceType,
): boolean {
  return targetQualification === getNextQualificationLevel(currentQualification, serviceType);
}

const gradeReadiness: Record<TargetGrade, number> = {
  2: 35,
  3: 60,
  4: 80,
  5: 100,
};

const coreSubjectSlugs = new Set([
  "medical-training",
  "firearms-training",
  "rhb-protection",
  "military-regulations",
]);

const directionSubjectSlugs: Record<ServiceDirection, string[]> = {
  general: ["tactical-training", "military-topography", "engineering-training"],
  command: ["tactical-training", "military-topography"],
  technical: ["engineering-training", "rhb-protection"],
  engineering: ["engineering-training", "military-topography"],
  communications: ["military-topography", "engineering-training"],
  logistics: ["military-topography", "medical-training"],
  medical_support: ["medical-training", "rhb-protection"],
};

function getSubjectPriority(
  subject: Subject,
  profile: QualificationProfile | null,
): Pick<QualificationSubjectReadiness, "preparationPriority" | "priorityReason"> {
  if (coreSubjectSlugs.has(subject.slug)) {
    return {
      preparationPriority: "core",
      priorityReason: "Базовое учебное ядро приложения.",
    };
  }
  const isProfileSubject = profile && (
    directionSubjectSlugs[profile.serviceDirection].includes(subject.slug) ||
    ((profile.hasSubordinates || profile.positionProfile === "leader") &&
      subject.slug === "tactical-training")
  );
  return isProfileSubject
    ? {
        preparationPriority: "profile",
        priorityReason: "Учебный приоритет по выбранному обобщённому профилю.",
      }
    : {
        preparationPriority: "additional",
        priorityReason: "Дополнительный предмет; включите его, если он нужен по вашей программе.",
      };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function addMonths(dateValue: string, months: number): Date | null {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

function dateOnly(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function gradeQualificationTest(correctAnswers: number, totalQuestions: number): TargetGrade {
  if (totalQuestions <= 0) return 2;
  const incorrectRate = (totalQuestions - correctAnswers) / totalQuestions;
  if (incorrectRate <= 0.1) return 5;
  if (incorrectRate <= 0.2) return 4;
  if (incorrectRate <= 0.4) return 3;
  return 2;
}

export function predictQualification(
  grades: TargetGrade[],
  physicalGrade: TargetGrade | null,
  serviceType: ServiceType = "contract",
): QualificationLevel {
  if (grades.length < 4 || physicalGrade === null || physicalGrade < 3) return "none";

  const excellent = grades.filter((grade) => grade === 5).length;
  const goodOrExcellent = grades.filter((grade) => grade >= 4).length;
  const requiredSeventyPercent = Math.ceil(grades.length * 0.7);

  if (grades.every((grade) => grade >= 4) && grades.filter((grade) => grade === 4).length <= 1) {
    return serviceType === "conscript" ? "first" : "master";
  }
  if (excellent >= requiredSeventyPercent && grades.every((grade) => grade >= 4)) {
    return "first";
  }
  if (grades.every((grade) => grade >= 4)) return "second";
  if (goodOrExcellent >= requiredSeventyPercent && grades.every((grade) => grade >= 3)) {
    return "third";
  }
  return "none";
}

export function reachesQualification(
  predicted: QualificationLevel,
  target: QualificationLevel,
): boolean {
  return qualificationRank[predicted] >= qualificationRank[target];
}

export function buildQualificationExamResult(input: {
  id: string;
  targetQualification: Exclude<QualificationLevel, "none">;
  physicalGrade: TargetGrade | null;
  serviceType?: ServiceType;
  subjectResults: QualificationExamSubjectResult[];
  completedAt?: string;
}): QualificationExamResult {
  const demonstratedQualification = predictQualification(
    input.subjectResults.map((result) => result.grade),
    input.physicalGrade,
    input.serviceType,
  );
  const predictedQualification = qualificationRank[demonstratedQualification]
    > qualificationRank[input.targetQualification]
    ? input.targetQualification
    : demonstratedQualification;
  const qualifiesForTarget = reachesQualification(predictedQualification, input.targetQualification);
  const blockers: string[] = [];

  if (input.physicalGrade === null) {
    blockers.push("Добавьте актуальный результат физической подготовки.");
  } else if (input.physicalGrade < 3) {
    blockers.push("Для классной квалификации физическая подготовленность должна быть не ниже оценки 3.");
  }
  if (!qualifiesForTarget) {
    blockers.push(
      `Результаты предметов пока не соответствуют уровню «${qualificationLabels[input.targetQualification]}».`,
    );
  }

  return {
    id: input.id,
    targetQualification: input.targetQualification,
    predictedQualification,
    qualifiesForTarget,
    physicalGrade: input.physicalGrade,
    averageScorePercent: clampPercent(average(input.subjectResults.map((result) => result.scorePercent))),
    subjectResults: input.subjectResults,
    blockers,
    policyVersion: QUALIFICATION_POLICY_VERSION,
    completedAt: input.completedAt ?? new Date().toISOString(),
  };
}

function getEligibility(profile: QualificationProfile): {
  eligibleAt: string | null;
  label: string;
  isEligible: boolean;
} {
  if (reachesQualification(profile.currentQualification, profile.targetQualification)) {
    return {
      eligibleAt: profile.qualificationExpiresAt,
      label: "Целевая классная квалификация уже достигнута.",
      isEligible: true,
    };
  }

  const eligibilityDate = profile.currentQualification !== "none" && profile.qualificationExpiresAt
    ? new Date(`${profile.qualificationExpiresAt}T00:00:00`)
    : addMonths(profile.serviceStartedAt, profile.serviceType === "contract" ? 12 : 3);
  const eligibleAt = dateOnly(eligibilityDate);
  const isEligible = eligibilityDate ? eligibilityDate.getTime() <= Date.now() : false;

  return {
    eligibleAt,
    isEligible,
    label: !eligibleAt
      ? "Уточните дату начала службы."
      : isEligible
        ? "По указанным датам можно готовиться к участию в испытаниях."
        : `Ориентировочная дата допуска — ${formatDate(eligibleAt)}.`,
  };
}

function requirement(
  id: string,
  title: string,
  description: string,
  progressPercent: number,
  href: string,
  blocked = false,
): QualificationRequirementProgress {
  const progress = clampPercent(progressPercent);
  return {
    id,
    title,
    description,
    progressPercent: progress,
    status: blocked ? "blocked" : progress >= 100 ? "ready" : progress > 0 ? "in_progress" : "not_started",
    href,
  };
}

export function buildQualificationRoadmap(input: {
  profile: QualificationProfile | null;
  physicalProfile: PhysicalProfile | null;
  subjects: Subject[];
  practiceResults: PracticeResult[];
  examResults: QualificationExamResult[];
}): QualificationRoadmap {
  const priorityRank = { core: 0, profile: 1, additional: 2 } as const;
  const subjectReadiness = input.subjects.map((subject) => ({
    subjectId: subject.id,
    title: subject.title,
    progressPercent: subject.progressPercent,
    lastScore: subject.lastScore,
    readinessPercent: clampPercent(
      subject.progressPercent * 0.6 + (subject.lastScore ?? 0) * 0.4,
    ),
    ...getSubjectPriority(subject, input.profile),
  })).sort((left, right) =>
    priorityRank[left.preparationPriority] - priorityRank[right.preparationPriority],
  );
  const routeSubjects = subjectReadiness.filter(
    (subject) => subject.preparationPriority !== "additional",
  );
  const learningReadinessPercent = clampPercent(
    average((routeSubjects.length >= 4 ? routeSubjects : subjectReadiness).map(
      (subject) => subject.readinessPercent,
    )),
  );
  const latestExam = [...input.examResults].sort(
    (left, right) => right.completedAt.localeCompare(left.completedAt),
  )[0] ?? null;
  const latestPhysical = [...input.practiceResults]
    .filter((result) => result.category === "physical")
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt))[0] ?? null;
  const physicalAssessment = input.physicalProfile && input.profile
    ? assessPhysicalResults(input.physicalProfile, input.profile.serviceType, input.practiceResults)
    : null;
  const legacyPhysicalGrade = latestPhysical?.points === null || latestPhysical?.points === undefined
    ? latestPhysical?.grade ?? null
    : null;
  const professionalResults = input.practiceResults.filter(
    (result) => result.category === "professional",
  );
  const practiceReadinessPercent = clampPercent(
    professionalResults.length === 0
      ? 0
      : average(professionalResults.map((result) => gradeReadiness[result.grade])),
  );
  const examReadinessPercent = latestExam?.averageScorePercent ?? 0;
  const physicalReadinessPercent = physicalAssessment?.progressPercent
    ?? (legacyPhysicalGrade ? gradeReadiness[legacyPhysicalGrade] : 0);

  if (!input.profile) {
    return {
      profile: null,
      readinessPercent: 0,
      learningReadinessPercent,
      practiceReadinessPercent,
      examReadinessPercent,
      physicalGrade: physicalAssessment?.grade ?? legacyPhysicalGrade,
      eligibleAt: null,
      eligibilityLabel: "Сначала настройте персональный маршрут.",
      predictedQualification: "none",
      targetReached: false,
      blockers: ["Не заполнен служебный профиль и не выбрана целевая классность."],
      requirements: [
        requirement(
          "profile",
          "Настроить маршрут",
          "Укажите обобщённую категорию должности, срок службы и целевую классность.",
          0,
          "/onboarding",
          true,
        ),
      ],
      subjects: subjectReadiness,
      latestExam,
      physical: {
        profile: input.physicalProfile,
        assessment: physicalAssessment,
        targetBonusPercent: 0,
      },
    };
  }

  const eligibility = getEligibility(input.profile);
  const physicalGrade = physicalAssessment?.grade ?? legacyPhysicalGrade;
  const predictedQualification = latestExam?.predictedQualification ?? "none";
  const targetReached = latestExam?.qualifiesForTarget ?? false;
  const blockers: string[] = [];
  const nextQualification = getNextQualificationLevel(
    input.profile.currentQualification,
    input.profile.serviceType,
  );

  if (!eligibility.isEligible) blockers.push(eligibility.label);
  if (qualificationRank[input.profile.targetQualification] > qualificationRank[nextQualification]) {
    blockers.push(
      `Долгосрочная цель достигается поэтапно; ближайший этап — «${qualificationLabels[nextQualification]}».`,
    );
  }
  if (routeSubjects.filter((subject) => subject.readinessPercent >= 60).length < 4) {
    blockers.push("Подготовьте не менее четырёх базовых или профильных предметов до устойчивого уровня.");
  }
  if (professionalResults.length === 0) {
    blockers.push("Добавьте результаты самостоятельной практической подготовки.");
  }
  if (physicalGrade === null) {
    blockers.push("Добавьте актуальную оценку физической подготовленности.");
  } else if (physicalGrade < 3) {
    blockers.push("Физическая подготовленность должна быть не ниже оценки 3.");
  }
  if (!latestExam) {
    blockers.push("Пройдите пробное квалификационное испытание.");
  } else if (!targetReached) {
    blockers.push(...latestExam.blockers.filter((blocker) => !blockers.includes(blocker)));
  }

  const readinessPercent = clampPercent(
    learningReadinessPercent * 0.45 +
      examReadinessPercent * 0.35 +
      practiceReadinessPercent * 0.1 +
      physicalReadinessPercent * 0.1,
  );
  const preparedSubjects = routeSubjects.filter((subject) => subject.readinessPercent >= 60).length;

  return {
    profile: input.profile,
    readinessPercent,
    learningReadinessPercent,
    practiceReadinessPercent,
    examReadinessPercent,
    physicalGrade,
    eligibleAt: eligibility.eligibleAt,
    eligibilityLabel: eligibility.label,
    predictedQualification,
    targetReached,
    blockers,
    requirements: [
      requirement(
        "theory",
        "Теоретическая подготовка",
        `${preparedSubjects} предметов достигли устойчивого уровня; для пробного испытания нужно не менее четырёх.`,
        Math.min(100, preparedSubjects * 25),
        "/subjects",
      ),
      requirement(
        "practice",
        "Практические результаты",
        professionalResults.length > 0
          ? `Внесено результатов: ${professionalResults.length}.`
          : "Добавьте выполненные нормативы и упражнения.",
        Math.min(100, professionalResults.length * 34),
        "/practice",
      ),
      requirement(
        "physical",
        "Физическая подготовленность",
        physicalGrade ? `Последняя самостоятельная оценка: ${physicalGrade}.` : "Результат ещё не указан.",
        physicalGrade ? gradeReadiness[physicalGrade] : 0,
        "/practice",
        physicalGrade !== null && physicalGrade < 3,
      ),
      requirement(
        "exam",
        "Пробное испытание",
        latestExam
          ? `Прогноз: ${qualificationLabels[predictedQualification]}.`
          : "Пройдите контрольный режим по четырём или более предметам.",
        latestExam ? latestExam.averageScorePercent : 0,
        "/qualification/exam",
      ),
    ],
    subjects: subjectReadiness,
    latestExam,
    physical: {
      profile: input.physicalProfile,
      assessment: physicalAssessment,
      targetBonusPercent: input.physicalProfile && input.profile.serviceType === "contract"
        ? physicalBonusPercent[input.physicalProfile.targetLevel]
        : 0,
    },
  };
}
