export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProgressStatus = "not_started" | "in_progress" | "completed";
type ActivityType = "theory" | "quiz" | "free_answer";
type AttemptStatus = "draft" | "submitted" | "reviewing" | "completed";

type DbTable<Row, RequiredInsert extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type SubjectRow = {
  id: string;
  code: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string | null;
  theme: "blue" | "olive";
  position: number;
  estimated_minutes: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type ModuleRow = {
  id: string;
  subject_id: string;
  title: string;
  position: number;
  summary: string;
  estimated_minutes: number | null;
  objective: string | null;
  key_principle: string | null;
  short_summary: string | null;
  learning_tip: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type ModuleSectionRow = {
  id: string;
  module_id: string;
  title: string;
  body: string;
  position: number;
};

type LearningActivityRow = {
  id: string;
  module_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  position: number;
  estimated_minutes: number | null;
  prompt: string | null;
  instructions: string | null;
  hint: string | null;
  max_length: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type ActivityQuestionRow = {
  id: string;
  activity_id: string;
  prompt: string;
  instructions: string;
  hint: string | null;
  position: number;
};

type QuestionOptionRow = {
  id: string;
  question_id: string;
  label: string;
  text: string;
  position: number;
};

type QuestionAnswerKeyRow = {
  question_id: string;
  correct_option_id: string;
  explanation: string | null;
};

type EvaluationCriterionRow = {
  id: string;
  activity_id: string;
  title: string;
  weight_percent: number;
  position: number;
};

type UserActivityProgressRow = {
  user_id: string;
  activity_id: string;
  status: ProgressStatus;
  progress_percent: number;
  updated_at: string;
};

type ActivityAttemptRow = {
  id: string;
  user_id: string;
  activity_id: string;
  status: AttemptStatus;
  current_position: number;
  score: number | null;
  result_label: string | null;
  result_summary: string | null;
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type QuizAnswerRow = {
  attempt_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean | null;
  answered_at: string;
};

type FreeAnswerSubmissionRow = {
  id: string;
  attempt_id: string;
  answer: string;
  ai_strength: string | null;
  ai_improvement: string | null;
  ai_recommendation: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type CriterionScoreRow = {
  submission_id: string;
  criterion_id: string;
  score: number;
  feedback: string | null;
};

type DailyPlanItemRow = {
  id: string;
  user_id: string;
  activity_id: string | null;
  scheduled_for: string;
  title: string;
  estimated_minutes: number;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: DbTable<ProfileRow, "id">;
      subjects: DbTable<SubjectRow, "code" | "slug" | "title" | "subtitle" | "position">;
      modules: DbTable<ModuleRow, "subject_id" | "title" | "position">;
      module_sections: DbTable<ModuleSectionRow, "module_id" | "title" | "body" | "position">;
      learning_activities: DbTable<
        LearningActivityRow,
        "module_id" | "type" | "title" | "position"
      >;
      activity_questions: DbTable<
        ActivityQuestionRow,
        "activity_id" | "prompt" | "position"
      >;
      question_options: DbTable<
        QuestionOptionRow,
        "question_id" | "label" | "text" | "position"
      >;
      question_answer_keys: DbTable<
        QuestionAnswerKeyRow,
        "question_id" | "correct_option_id"
      >;
      evaluation_criteria: DbTable<
        EvaluationCriterionRow,
        "activity_id" | "title" | "weight_percent" | "position"
      >;
      user_activity_progress: DbTable<
        UserActivityProgressRow,
        "user_id" | "activity_id"
      >;
      activity_attempts: DbTable<ActivityAttemptRow, "user_id" | "activity_id">;
      quiz_answers: DbTable<
        QuizAnswerRow,
        "attempt_id" | "question_id" | "selected_option_id"
      >;
      free_answer_submissions: DbTable<
        FreeAnswerSubmissionRow,
        "attempt_id"
      >;
      criterion_scores: DbTable<
        CriterionScoreRow,
        "submission_id" | "criterion_id" | "score"
      >;
      daily_plan_items: DbTable<
        DailyPlanItemRow,
        "user_id" | "title" | "estimated_minutes" | "position"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      activity_type: ActivityType;
      progress_status: ProgressStatus;
      attempt_status: AttemptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
