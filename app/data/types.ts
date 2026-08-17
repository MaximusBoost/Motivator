export type Identifier = string;

export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type SubjectTheme = "blue" | "olive";
export type ActivityType = "theory" | "quiz" | "free_answer";
export type AttemptStatus = "draft" | "submitted" | "reviewing" | "completed";
export type TargetGrade = 2 | 3 | 4 | 5;
export type ServiceType = "contract" | "conscript";
export type PersonnelCategory = "officer" | "warrant_officer" | "sergeant" | "soldier";
export type PositionProfile = "leader" | "specialist" | "primary";
export type ServiceDirection =
  | "general"
  | "command"
  | "technical"
  | "engineering"
  | "communications"
  | "logistics"
  | "medical_support";
export type QualificationLevel = "none" | "third" | "second" | "first" | "master";
export type PracticeCategory = "professional" | "physical";
export type PhysicalSex = "male" | "female";
export type PhysicalAssessmentCategory = 1 | 2 | 3;
export type PhysicalQualificationLevel = "third" | "second" | "first" | "highest";
export type PhysicalQuality = "strength" | "speed" | "endurance";
export type PhysicalExerciseId = "push_ups" | "pull_ups" | "run_100m" | "run_1km";

export type TheorySection = {
  id: Identifier;
  title: string;
  body: string;
  position: number;
};

export type LearningSource = {
  id: Identifier;
  title: string;
  kind: "user_document" | "official_legal" | "official_guidance" | "training_manual";
  fileName: string | null;
  uri: string | null;
  versionLabel: string;
  verifiedAt: string | null;
  isCurrentVerified: boolean;
  notes: string;
  locator: string;
};

export type AnswerOption = {
  id: Identifier;
  label: string;
  text: string;
};

export type QuizQuestion = {
  id: Identifier;
  prompt: string;
  instructions: string;
  hint: string | null;
  position: number;
  options: AnswerOption[];
};

export type EvaluationCriterion = {
  id: Identifier;
  title: string;
  weightPercent: number;
  position: number;
};

type ActivityBase = {
  id: Identifier;
  moduleId: Identifier;
  title: string;
  description: string | null;
  position: number;
  estimatedMinutes: number | null;
};

export type TheoryActivity = ActivityBase & {
  type: "theory";
};

export type QuizActivity = ActivityBase & {
  type: "quiz";
  questions: QuizQuestion[];
};

export type FreeAnswerActivity = ActivityBase & {
  type: "free_answer";
  prompt: string;
  instructions: string;
  maxLength: number;
  criteria: EvaluationCriterion[];
};

export type LearningActivity = TheoryActivity | QuizActivity | FreeAnswerActivity;

export type LearningModule = {
  id: Identifier;
  subjectId: Identifier;
  number: number;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  objective: string | null;
  keyPrinciple: string | null;
  shortSummary: string | null;
  learningTip: string | null;
  sections: TheorySection[];
  sources: LearningSource[];
  activities: LearningActivity[];
  status: ProgressStatus;
  progressPercent: number;
};

export type Subject = {
  id: Identifier;
  code: string;
  slug: string;
  title: string;
  subtitle: string;
  theme: SubjectTheme;
  position: number;
  estimatedMinutes: number;
  modules: LearningModule[];
  status: ProgressStatus;
  progressPercent: number;
  lastScore: number | null;
};

export type TodayPlanItem = {
  id: Identifier;
  title: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  activityId: Identifier | null;
};

export type DashboardStats = {
  subjectsStarted: number;
  averageScore: number;
  quizzesCompleted: number;
  needsReview: number;
};

export type ContinueLearning = {
  subjectId: Identifier;
  subjectTitle: string;
  subjectCode: string;
  moduleId: Identifier;
  moduleNumber: number;
  modulesTotal: number;
  moduleTitle: string;
  nextActivityId: Identifier;
  nextActivityType: ActivityType;
  nextActivityTitle: string;
  progressPercent: number;
};

export type DashboardData = {
  stats: DashboardStats;
  continueLearning: ContinueLearning | null;
  todayPlan: TodayPlanItem[];
  featuredSubjects: Subject[];
};

export type CriterionScore = {
  criterionId: Identifier;
  title: string;
  score: number;
  feedback?: string | null;
};

export type AiFeedback = {
  strength: string;
  improvement: string;
  recommendation: string;
};

export type AssessmentResult = {
  id: Identifier;
  activityId: Identifier;
  activityType: "quiz" | "free_answer";
  reviewStatus: AttemptStatus;
  score: number;
  statusLabel: string;
  summary: string;
  submittedAnswer: string | null;
  criterionScores: CriterionScore[];
  aiFeedback: AiFeedback | null;
  completedAt: string;
};

export type FreeAnswerDraft = {
  activityId: Identifier;
  answer: string;
  updatedAt: string;
};

export type SubjectGoal = {
  subjectId: Identifier;
  targetGrade: TargetGrade;
  updatedAt: string;
};

export type QualificationProfileInput = {
  isActiveServiceMember: boolean;
  serviceType: ServiceType;
  personnelCategory: PersonnelCategory;
  positionProfile: PositionProfile;
  hasSubordinates: boolean;
  serviceDirection: ServiceDirection;
  serviceStartedAt: string;
  currentQualification: QualificationLevel;
  qualificationAwardedAt: string | null;
  qualificationExpiresAt: string | null;
  targetQualification: Exclude<QualificationLevel, "none">;
};

export type QualificationProfile = QualificationProfileInput & {
  userId: Identifier;
  policyVersion: string;
  onboardingCompletedAt: string;
  activeServiceConfirmedAt: string;
  updatedAt: string;
};

export type PhysicalProfileInput = {
  sex: PhysicalSex;
  birthDate: string;
  assessmentCategory: PhysicalAssessmentCategory;
  targetLevel: PhysicalQualificationLevel;
};

export type PhysicalProfile = PhysicalProfileInput & {
  userId: Identifier;
  policyVersion: string;
  updatedAt: string;
};

export type PhysicalAssessmentSummary = {
  grade: TargetGrade | null;
  preliminaryLevel: PhysicalQualificationLevel | null;
  sumPoints: number;
  requiredExerciseCount: number;
  countedExerciseCount: number;
  minimumPointsPerExercise: number;
  missingQualities: PhysicalQuality[];
  progressPercent: number;
  targetPoints: number | null;
  isComplete: boolean;
};

export type PhysicalRoadmap = {
  profile: PhysicalProfile | null;
  assessment: PhysicalAssessmentSummary | null;
  targetBonusPercent: number;
};

export type QualificationRequirementProgress = {
  id: Identifier;
  title: string;
  description: string;
  progressPercent: number;
  status: "not_started" | "in_progress" | "ready" | "blocked";
  href: string;
};

export type QualificationSubjectReadiness = {
  subjectId: Identifier;
  title: string;
  progressPercent: number;
  lastScore: number | null;
  readinessPercent: number;
  preparationPriority: "core" | "profile" | "additional";
  priorityReason: string;
};

export type QualificationRoadmap = {
  profile: QualificationProfile | null;
  readinessPercent: number;
  learningReadinessPercent: number;
  practiceReadinessPercent: number;
  examReadinessPercent: number;
  physicalGrade: TargetGrade | null;
  eligibleAt: string | null;
  eligibilityLabel: string;
  predictedQualification: QualificationLevel;
  targetReached: boolean;
  blockers: string[];
  requirements: QualificationRequirementProgress[];
  subjects: QualificationSubjectReadiness[];
  latestExam: QualificationExamResult | null;
  physical: PhysicalRoadmap;
};

export type QualificationExamSubject = {
  subjectId: Identifier;
  subjectTitle: string;
  subjectTheme: SubjectTheme;
  questions: QuizQuestion[];
};

export type QualificationExam = {
  policyVersion: string;
  targetQualification: Exclude<QualificationLevel, "none">;
  subjects: QualificationExamSubject[];
  questionsPerSubject: number;
  startedAt: string;
};

export type QualificationExamSubjectResult = {
  subjectId: Identifier;
  subjectTitle: string;
  correctAnswers: number;
  totalQuestions: number;
  scorePercent: number;
  grade: TargetGrade;
};

export type QualificationExamResult = {
  id: Identifier;
  targetQualification: Exclude<QualificationLevel, "none">;
  predictedQualification: QualificationLevel;
  qualifiesForTarget: boolean;
  physicalGrade: TargetGrade | null;
  averageScorePercent: number;
  subjectResults: QualificationExamSubjectResult[];
  blockers: string[];
  policyVersion: string;
  completedAt: string;
};

export type PracticeResultInput = {
  category: PracticeCategory;
  subjectId: Identifier | null;
  title: string;
  value: number;
  unit: string;
  grade: TargetGrade;
  performedAt: string;
  notes: string | null;
  physicalExerciseId?: PhysicalExerciseId | null;
  physicalQuality?: PhysicalQuality | null;
  points?: number | null;
  ageGroup?: number | null;
};

export type PracticeResult = PracticeResultInput & {
  id: Identifier;
  userId: Identifier;
  source: "self_reported";
  createdAt: string;
  updatedAt: string;
};

export type PhysicalTrainingAdvice = {
  id: Identifier;
  userId: Identifier;
  basedOnResultId: Identifier;
  summary: string;
  recommendations: string[];
  caution: string;
  source: "ai" | "demo_algorithm";
  generatedAt: string;
};

export type PhysicalTrainingSession = {
  day: string;
  title: string;
  details: string;
  intensity: string;
};

export type PhysicalTrainingProgram = {
  title: string;
  durationWeeks: number;
  rationale: string;
  weeklySessions: PhysicalTrainingSession[];
  progression: string[];
  caution: string;
};

export type SubjectCardType = {
  title: string;
  subtitle: string;
  modules: [];
  progressPercent: number;
  id: string;
};
