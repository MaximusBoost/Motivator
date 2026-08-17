import type { AiApiError, FreeAnswerAiReview } from "~/data/ai-review-contract";

function isReview(value: unknown): value is FreeAnswerAiReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<FreeAnswerAiReview>;
  return review.provider === "gigachat" &&
    typeof review.activityId === "string" &&
    typeof review.model === "string" &&
    Number.isInteger(review.score) &&
    Array.isArray(review.criterionScores) &&
    Boolean(review.feedback && typeof review.feedback === "object");
}

export async function requestLocalFreeAnswerReview(
  activityId: string,
  answer: string,
): Promise<FreeAnswerAiReview> {
  let response: Response;
  try {
    response = await fetch("/api/ai/review-free-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, answer }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("GigaChat не ответил за отведённое время. Попробуйте ещё раз.");
    }
    throw new Error(
      "Локальный AI API недоступен. Убедитесь, что приложение запущено через npm run dev.",
    );
  }

  const payload = await response.json().catch(() => null) as AiApiError | FreeAnswerAiReview | null;
  if (!response.ok) {
    const error = payload as AiApiError | null;
    throw new Error(error?.error || `Проверка GigaChat завершилась с ошибкой HTTP ${response.status}.`);
  }
  if (!isReview(payload)) {
    throw new Error("Локальный AI API вернул некорректный результат проверки.");
  }
  return payload;
}
