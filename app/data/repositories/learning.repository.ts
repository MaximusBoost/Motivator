import type {
  AssessmentResult,
  DashboardData,
  FreeAnswerActivity,
  FreeAnswerDraft,
  LearningModule,
  PracticeResult,
  PracticeResultInput,
  PhysicalTrainingAdvice,
  QualificationExam,
  QualificationExamResult,
  QualificationProfile,
  QualificationProfileInput,
  QualificationRoadmap,
  QuizActivity,
  Subject,
  SubjectGoal,
  TargetGrade,
} from "~/data/types";

export interface LearningRepository {
  getDashboard(userId?: string): Promise<DashboardData>;
  getSubjects(userId?: string): Promise<Subject[]>;
  getSubjectBySlug(slug: string, userId?: string): Promise<Subject | null>;
  getModule(moduleId: string, userId?: string): Promise<LearningModule | null>;
  getQuiz(activityId: string): Promise<QuizActivity | null>;
  getFreeAnswer(activityId: string): Promise<FreeAnswerActivity | null>;
  getResults(userId?: string): Promise<AssessmentResult[]>;
  getResult(attemptId: string, userId?: string): Promise<AssessmentResult | null>;
  submitQuiz(
    activityId: string,
    answers: Record<string, string>,
    userId?: string,
  ): Promise<AssessmentResult>;
  submitFreeAnswer(
    activityId: string,
    answer: string,
    userId?: string,
  ): Promise<AssessmentResult>;
  completeTheory(activityId: string, userId?: string): Promise<void>;
  saveQuizProgress(
    activityId: string,
    answeredCount: number,
    totalQuestions: number,
    userId?: string,
  ): Promise<void>;
  setTodayPlanItemCompleted(
    itemId: string,
    isCompleted: boolean,
    userId?: string,
  ): Promise<void>;
  getGoals(userId?: string): Promise<SubjectGoal[]>;
  setGoal(subjectId: string, targetGrade: TargetGrade, userId?: string): Promise<SubjectGoal>;
  saveFreeAnswerDraft(
    activityId: string,
    answer: string,
    userId?: string,
  ): Promise<FreeAnswerDraft>;
  getQualificationProfile(userId?: string): Promise<QualificationProfile | null>;
  saveQualificationProfile(
    input: QualificationProfileInput,
    userId?: string,
  ): Promise<QualificationProfile>;
  getQualificationRoadmap(userId?: string): Promise<QualificationRoadmap>;
  createQualificationExam(subjectIds: string[], userId?: string): Promise<QualificationExam>;
  submitQualificationExam(
    exam: QualificationExam,
    answers: Record<string, string>,
    userId?: string,
  ): Promise<QualificationExamResult>;
  getQualificationExamResult(
    attemptId: string,
    userId?: string,
  ): Promise<QualificationExamResult | null>;
  getPracticeResults(userId?: string): Promise<PracticeResult[]>;
  getPhysicalTrainingAdvice(userId?: string): Promise<PhysicalTrainingAdvice | null>;
  savePracticeResult(input: PracticeResultInput, userId?: string): Promise<PracticeResult>;
  deletePracticeResult(resultId: string, userId?: string): Promise<void>;
}
