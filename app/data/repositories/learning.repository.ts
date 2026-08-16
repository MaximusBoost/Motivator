import type {
  AssessmentResult,
  DashboardData,
  FreeAnswerActivity,
  FreeAnswerDraft,
  LearningModule,
  QuizActivity,
  Subject,
} from "~/data/types";

export interface LearningRepository {
  getDashboard(userId?: string): Promise<DashboardData>;
  getSubjects(userId?: string): Promise<Subject[]>;
  getSubjectBySlug(slug: string, userId?: string): Promise<Subject | null>;
  getModule(moduleId: string, userId?: string): Promise<LearningModule | null>;
  getQuiz(activityId: string): Promise<QuizActivity | null>;
  getFreeAnswer(activityId: string): Promise<FreeAnswerActivity | null>;
  getResults(userId?: string): Promise<AssessmentResult[]>;
  saveFreeAnswerDraft(
    activityId: string,
    answer: string,
    userId?: string,
  ): Promise<FreeAnswerDraft>;
}
