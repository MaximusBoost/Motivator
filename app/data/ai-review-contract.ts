export type AiCriterionReview = {
  criterionId: string;
  score: number;
  feedback: string;
};

export type FreeAnswerAiReview = {
  activityId: string;
  provider: "gigachat";
  model: string;
  score: number;
  summary: string;
  criterionScores: AiCriterionReview[];
  feedback: {
    strength: string;
    improvement: string;
    recommendation: string;
  };
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

export type AiApiError = {
  error: string;
  code?: string;
  retryable?: boolean;
};
