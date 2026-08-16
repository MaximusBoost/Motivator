export type Identifier = string;

export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type SubjectTheme = "blue" | "olive";
export type ActivityType = "theory" | "quiz" | "free_answer";
export type AttemptStatus = "draft" | "submitted" | "reviewing" | "completed";

export type TheorySection = {
  id: Identifier;
  title: string;
  body: string;
  position: number;
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
