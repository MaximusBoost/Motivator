import { randomUUID } from "node:crypto";

const OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_BASE_URL = "https://api.giga.chat/v1";
const VALID_SCOPES = new Set([
  "GIGACHAT_API_PERS",
  "GIGACHAT_API_B2B",
  "GIGACHAT_API_CORP",
]);

type FetchLike = typeof fetch;

export type GigaChatConfig = {
  credentials: string;
  scope: string;
  baseUrl: string;
  preferredModel: string | null;
  timeoutMs: number;
};

export type GigaChatUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type GenerateFunctionArgumentsInput = {
  functionDefinition: Record<string, unknown> & { name: string };
  systemPrompt: string;
  payload: unknown;
  maxTokens?: number;
};

export type GeneratedFunctionArguments<T> = {
  data: T;
  model: string;
  usage: GigaChatUsage;
};

type OAuthResponse = {
  access_token?: unknown;
  expires_at?: unknown;
};

type ModelsResponse = {
  data?: Array<{ id?: unknown }>;
};

type CompletionResponse = {
  model?: unknown;
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      function_call?: {
        name?: unknown;
        arguments?: unknown;
      };
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
};

export class GigaChatProviderError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { code: string; status?: number | null; retryable?: boolean },
  ) {
    super(message);
    this.name = "GigaChatProviderError";
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

function requiredEnvironment(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new GigaChatProviderError(`${name} is not configured`, {
      code: "provider_not_configured",
    });
  }
  return value;
}

export function readGigaChatConfig(
  environment: Record<string, string | undefined>,
): GigaChatConfig {
  const scope = environment.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS";
  if (!VALID_SCOPES.has(scope)) {
    throw new GigaChatProviderError("GIGACHAT_SCOPE is invalid", {
      code: "provider_not_configured",
    });
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(environment.GIGACHAT_BASE_URL?.trim() || DEFAULT_BASE_URL);
  } catch {
    throw new GigaChatProviderError("GIGACHAT_BASE_URL is invalid", {
      code: "provider_not_configured",
    });
  }
  if (baseUrl.protocol !== "https:") {
    throw new GigaChatProviderError("GIGACHAT_BASE_URL must use HTTPS", {
      code: "provider_not_configured",
    });
  }

  const timeoutValue = Number(environment.GIGACHAT_TIMEOUT_MS ?? 60_000);
  return {
    credentials: requiredEnvironment(environment, "GIGACHAT_CREDENTIALS"),
    scope,
    baseUrl: baseUrl.toString().replace(/\/+$/, ""),
    preferredModel: environment.GIGACHAT_MODEL?.trim() || null,
    timeoutMs: Number.isFinite(timeoutValue)
      ? Math.min(120_000, Math.max(5_000, Math.round(timeoutValue)))
      : 60_000,
  };
}

function safeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function providerMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "GigaChat request failed";
  const record = payload as Record<string, unknown>;
  for (const candidate of [record.message, record.error, record.error_description]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 400);
    }
  }
  return "GigaChat request failed";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new GigaChatProviderError(
      error instanceof Error ? error.message : "GigaChat network request failed",
      { code: "provider_network_error", retryable: true },
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new GigaChatProviderError("GigaChat returned invalid JSON", {
          code: "invalid_provider_json",
          status: response.status,
        });
      }
    }
  }
  if (!response.ok) {
    throw new GigaChatProviderError(providerMessage(payload), {
      code: "provider_http_error",
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }
  return payload;
}

function tokenExpiration(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Date.now() + 29 * 60_000;
  return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
}

function modelIds(payload: unknown): string[] {
  const response = payload as ModelsResponse;
  if (!Array.isArray(response?.data)) return [];
  return response.data
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    .map((id) => id.trim());
}

function chooseModel(ids: string[], preferredModel: string | null): string {
  if (preferredModel) {
    const match = ids.find((id) => id.toLowerCase() === preferredModel.toLowerCase());
    if (!match) {
      throw new GigaChatProviderError(`Configured model ${preferredModel} is unavailable`, {
        code: "model_unavailable",
      });
    }
    return match;
  }

  const chatModels = ids.filter((id) => !/embedding/i.test(id));
  for (const priority of [
    "GigaChat-3-Ultra",
    "GigaChat-2-Max",
    "GigaChat-2-Pro",
    "GigaChat-Max",
    "GigaChat-Pro",
    "GigaChat",
  ]) {
    const match = chatModels.find((id) =>
      id.toLowerCase() === priority.toLowerCase() ||
      id.toLowerCase().startsWith(`${priority.toLowerCase()}:`)
    );
    if (match) return match;
  }
  if (chatModels[0]) return chatModels[0];
  throw new GigaChatProviderError("No text generation model is available", {
    code: "model_unavailable",
  });
}

function parseArguments(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new GigaChatProviderError("Function arguments are not valid JSON", {
        code: "invalid_model_output",
      });
    }
  }
  throw new GigaChatProviderError("Function arguments are missing", {
    code: "invalid_model_output",
  });
}

export function createGigaChatClient(
  config: GigaChatConfig,
  fetchImpl: FetchLike = fetch,
) {
  let cachedToken: { value: string; expiresAt: number } | null = null;
  let cachedModel: string | null = null;

  async function accessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && cachedToken && cachedToken.expiresAt - 30_000 > Date.now()) {
      return cachedToken.value;
    }
    const authorization = /^Basic\s/i.test(config.credentials)
      ? config.credentials
      : `Basic ${config.credentials}`;
    const payload = await requestJson(fetchImpl, OAUTH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
        RqUID: randomUUID(),
      },
      body: new URLSearchParams({ scope: config.scope }),
    }, config.timeoutMs) as OAuthResponse;
    if (typeof payload.access_token !== "string" || !payload.access_token) {
      throw new GigaChatProviderError("GigaChat OAuth response has no access token", {
        code: "invalid_provider_response",
      });
    }
    cachedToken = {
      value: payload.access_token,
      expiresAt: tokenExpiration(payload.expires_at),
    };
    return cachedToken.value;
  }

  async function authorizedRequest(pathname: string, init: RequestInit): Promise<unknown> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const token = await accessToken(attempt > 1);
      try {
        return await requestJson(fetchImpl, `${config.baseUrl}${pathname}`, {
          ...init,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...init.headers,
          },
        }, config.timeoutMs);
      } catch (error) {
        if (
          attempt === 1 &&
          error instanceof GigaChatProviderError &&
          error.status === 401
        ) {
          cachedToken = null;
          continue;
        }
        throw error;
      }
    }
    throw new GigaChatProviderError("GigaChat authorization retry failed", {
      code: "provider_http_error",
      status: 401,
    });
  }

  async function selectedModel(): Promise<string> {
    if (cachedModel) return cachedModel;
    const payload = await authorizedRequest("/models", { method: "GET" });
    const ids = modelIds(payload);
    if (ids.length === 0) {
      throw new GigaChatProviderError("GigaChat returned no models", {
        code: "invalid_provider_response",
      });
    }
    cachedModel = chooseModel(ids, config.preferredModel);
    return cachedModel;
  }

  return {
    async generateFunctionArguments<T>(
      input: GenerateFunctionArgumentsInput,
    ): Promise<GeneratedFunctionArguments<T>> {
      const model = await selectedModel();
      const payload = await authorizedRequest("/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: JSON.stringify(input.payload) },
          ],
          functions: [input.functionDefinition],
          function_call: { name: input.functionDefinition.name },
          temperature: 0.1,
          max_tokens: input.maxTokens ?? 1_600,
          stream: false,
        }),
      }) as CompletionResponse;

      const choice = payload.choices?.[0];
      if (choice?.finish_reason === "error") {
        throw new GigaChatProviderError("GigaChat generated invalid function arguments", {
          code: "invalid_model_output",
        });
      }
      if (choice?.finish_reason !== "function_call") {
        throw new GigaChatProviderError("GigaChat did not call the required review function", {
          code: "invalid_model_output",
        });
      }
      const functionCall = choice.message?.function_call;
      if (functionCall?.name !== input.functionDefinition.name) {
        throw new GigaChatProviderError("GigaChat called an unexpected function", {
          code: "invalid_model_output",
        });
      }

      return {
        data: parseArguments(functionCall.arguments) as T,
        model: typeof payload.model === "string" ? payload.model : model,
        usage: {
          promptTokens: safeInteger(payload.usage?.prompt_tokens),
          completionTokens: safeInteger(payload.usage?.completion_tokens),
          totalTokens: safeInteger(payload.usage?.total_tokens),
        },
      };
    },
  };
}
