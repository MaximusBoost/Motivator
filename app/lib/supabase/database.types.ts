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
type ServiceType = "contract" | "conscript";
type PersonnelCategory = "officer" | "warrant_officer" | "sergeant" | "soldier";
type PositionProfile = "leader" | "specialist" | "primary";
type ServiceDirection =
  | "general"
  | "command"
  | "technical"
  | "engineering"
  | "communications"
  | "logistics"
  | "medical_support";
type QualificationLevel = "none" | "third" | "second" | "first" | "master";
type PracticeCategory = "professional" | "physical";
type ContentSourceKind =
  | "user_document"
  | "official_legal"
  | "official_guidance"
  | "training_manual";

type DbTable<Row, RequiredInsert extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  username: string;
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
  guidance: string;
  required_concepts: string[];
};

type ContentSourceRow = {
  id: string;
  source_key: string;
  subject_id: string;
  title: string;
  kind: ContentSourceKind;
  file_name: string | null;
  uri: string | null;
  version_label: string;
  published_on: string | null;
  verified_at: string | null;
  is_current_verified: boolean;
  notes: string;
  created_at: string;
};

type ModuleContentSourceRow = {
  module_id: string;
  source_id: string;
  locator: string;
};

type FreeAnswerRubricRow = {
  activity_id: string;
  reference_answer_points: string[];
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

type UserSubjectGoalRow = {
  user_id: string;
  subject_id: string;
  target_grade: 2 | 3 | 4 | 5;
  created_at: string;
  updated_at: string;
};

type UserQualificationProfileRow = {
  user_id: string;
  is_active_service_member: boolean;
  active_service_confirmed_at: string;
  service_type: ServiceType;
  personnel_category: PersonnelCategory;
  position_profile: PositionProfile;
  has_subordinates: boolean;
  service_direction: ServiceDirection;
  service_started_at: string;
  current_qualification: QualificationLevel;
  qualification_awarded_at: string | null;
  qualification_expires_at: string | null;
  target_qualification: QualificationLevel;
  policy_version: string;
  onboarding_completed_at: string;
  updated_at: string;
};

type UserPracticeResultRow = {
  id: string;
  user_id: string;
  category: PracticeCategory;
  subject_id: string | null;
  title: string;
  value: number;
  unit: string;
  grade: 2 | 3 | 4 | 5;
  performed_at: string;
  notes: string | null;
  source: "self_reported";
  created_at: string;
  updated_at: string;
};

type QualificationExamAttemptRow = {
  id: string;
  user_id: string;
  target_qualification: QualificationLevel;
  predicted_qualification: QualificationLevel;
  qualifies_for_target: boolean;
  physical_grade: 2 | 3 | 4 | 5 | null;
  average_score_percent: number;
  policy_version: string;
  started_at: string;
  completed_at: string;
};

type QualificationExamSubjectResultRow = {
  attempt_id: string;
  subject_id: string;
  correct_answers: number;
  total_questions: number;
  score_percent: number;
  grade: 2 | 3 | 4 | 5;
};

type QualificationExamAnswerRow = {
  attempt_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
};

type PhysicalTrainingAdviceRow = {
  id: string;
  user_id: string;
  based_on_result_id: string;
  summary: string;
  recommendations: Json;
  caution: string;
  source: "ai";
  generated_at: string;
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
      content_sources: DbTable<
        ContentSourceRow,
        "source_key" | "subject_id" | "title" | "kind" | "version_label"
      >;
      module_content_sources: DbTable<
        ModuleContentSourceRow,
        "module_id" | "source_id" | "locator"
      >;
      free_answer_rubrics: DbTable<
        FreeAnswerRubricRow,
        "activity_id" | "reference_answer_points"
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
      user_subject_goals: DbTable<
        UserSubjectGoalRow,
        "user_id" | "subject_id" | "target_grade"
      >;
      user_qualification_profiles: DbTable<
        UserQualificationProfileRow,
        | "user_id"
        | "is_active_service_member"
        | "active_service_confirmed_at"
        | "service_type"
        | "personnel_category"
        | "position_profile"
        | "service_direction"
        | "service_started_at"
        | "target_qualification"
        | "policy_version"
      >;
      user_practice_results: DbTable<
        UserPracticeResultRow,
        | "user_id"
        | "category"
        | "title"
        | "value"
        | "unit"
        | "grade"
        | "performed_at"
      >;
      physical_training_advice: DbTable<
        PhysicalTrainingAdviceRow,
        | "user_id"
        | "based_on_result_id"
        | "summary"
        | "recommendations"
        | "caution"
      >;
      qualification_exam_attempts: DbTable<
        QualificationExamAttemptRow,
        | "user_id"
        | "target_qualification"
        | "average_score_percent"
        | "policy_version"
        | "started_at"
      >;
      qualification_exam_subject_results: DbTable<
        QualificationExamSubjectResultRow,
        | "attempt_id"
        | "subject_id"
        | "correct_answers"
        | "score_percent"
        | "grade"
      >;
      qualification_exam_answers: DbTable<
        QualificationExamAnswerRow,
        "attempt_id" | "question_id" | "selected_option_id" | "is_correct"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      submit_quiz: {
        Args: {
          p_activity_id: string;
          p_answers: Json;
        };
        Returns: {
          attempt_id: string;
          score: number;
          correct_answers: number;
          total_questions: number;
        }[];
      };
      submit_qualification_exam: {
        Args: {
          p_subject_ids: string[];
          p_answers: Json;
          p_started_at: string;
        };
        Returns: {
          attempt_id: string;
        }[];
      };
    };
    Enums: {
      activity_type: ActivityType;
      progress_status: ProgressStatus;
      attempt_status: AttemptStatus;
      service_type: ServiceType;
      personnel_category: PersonnelCategory;
      position_profile: PositionProfile;
      service_direction: ServiceDirection;
      qualification_level: QualificationLevel;
      practice_category: PracticeCategory;
      content_source_kind: ContentSourceKind;
    };
    CompositeTypes: Record<string, never>;
  };
};
