import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import type { AiApiError } from "../app/data/ai-review-contract.ts";
import { FreeAnswerReviewError, createFreeAnswerReviewer } from "./ai/free-answer-review.ts";
import { GigaChatProviderError } from "./ai/gigachat.ts";

const ENDPOINT = "/api/ai/review-free-answer";
const MAX_BODY_BYTES = 16_384;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new FreeAnswerReviewError("Тело запроса слишком большое.", {
        code: "request_too_large",
        status: 413,
      });
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FreeAnswerReviewError("Некорректный JSON запроса.", {
      code: "invalid_request_json",
      status: 400,
    });
  }
}

function publicProviderError(error: GigaChatProviderError): {
  status: number;
  body: AiApiError;
} {
  if (error.code === "provider_not_configured") {
    return {
      status: 503,
      body: {
        error: "GigaChat не настроен. Проверьте .env.ai.local и перезапустите npm run dev.",
        code: error.code,
        retryable: false,
      },
    };
  }
  if (error.status === 401) {
    return {
      status: 502,
      body: {
        error: "GigaChat отклонил ключ авторизации или scope.",
        code: "provider_authorization_error",
        retryable: false,
      },
    };
  }
  if (error.status === 429) {
    return {
      status: 429,
      body: {
        error: "Достигнут лимит запросов GigaChat. Повторите проверку позднее.",
        code: "provider_rate_limit",
        retryable: true,
      },
    };
  }
  return {
    status: 502,
    body: {
      error: "GigaChat временно не выполнил проверку. Ответ не потерян — повторите отправку.",
      code: error.code,
      retryable: error.retryable,
    },
  };
}

export function localAiPlugin(): Plugin {
  return {
    name: "motivator-local-ai",
    apply: "serve",
    configureServer(server) {
      let reviewer: ReturnType<typeof createFreeAnswerReviewer> | null = null;
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
        if (pathname !== ENDPOINT) {
          next();
          return;
        }
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Метод не поддерживается.", code: "method_not_allowed" });
          return;
        }
        if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
          sendJson(response, 415, { error: "Ожидается application/json.", code: "unsupported_media_type" });
          return;
        }

        try {
          const payload = await readJsonBody(request) as {
            activityId?: unknown;
            answer?: unknown;
          };
          if (typeof payload.activityId !== "string" || typeof payload.answer !== "string") {
            throw new FreeAnswerReviewError("Нужны строковые поля activityId и answer.", {
              code: "invalid_request",
              status: 400,
            });
          }
          reviewer ??= createFreeAnswerReviewer(process.env);
          const result = await reviewer(payload.activityId, payload.answer);
          sendJson(response, 200, result);
        } catch (error) {
          if (error instanceof FreeAnswerReviewError) {
            sendJson(response, error.status, { error: error.message, code: error.code });
            return;
          }
          if (error instanceof GigaChatProviderError) {
            const publicError = publicProviderError(error);
            console.error("Local GigaChat review failed", {
              code: error.code,
              status: error.status,
            });
            sendJson(response, publicError.status, publicError.body);
            return;
          }
          console.error("Local free-answer review failed", error);
          sendJson(response, 500, {
            error: "Не удалось выполнить локальную AI-проверку.",
            code: "internal_error",
          });
        }
      });
    },
  };
}
