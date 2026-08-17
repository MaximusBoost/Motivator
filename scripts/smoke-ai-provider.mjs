import assert from "node:assert/strict";
import path from "node:path";

import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
});

try {
  const {
    AiProviderError,
    generateStructuredJson,
    readOpenAiConfig,
  } = await vite.ssrLoadModule("/supabase/functions/_shared/openai.ts");

  const config = readOpenAiConfig({
    OPENAI_API_KEY: "test-secret",
    OPENAI_MODEL: "test-model",
    OPENAI_BASE_URL: "https://api.example.test/v1/",
    OPENAI_TIMEOUT_MS: "5000",
  });
  assert.equal(config.baseUrl, "https://api.example.test/v1");
  assert.equal(config.model, "test-model");

  let capturedBody;
  const successfulFetch = async (url, init) => {
    assert.equal(url, "https://api.example.test/v1/responses");
    assert.equal(init.headers.Authorization, "Bearer test-secret");
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      id: "resp_test",
      model: "test-model-2026-01-01",
      status: "completed",
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ score: 91 }) }],
      }],
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
    }), {
      status: 200,
      headers: { "x-request-id": "req_test" },
    });
  };

  const result = await generateStructuredJson(config, {
    schemaName: "test_result",
    schema: {
      type: "object",
      properties: { score: { type: "integer" } },
      required: ["score"],
      additionalProperties: false,
    },
    systemPrompt: "Return a score.",
    payload: { answer: "untrusted answer" },
    userId: "real-user-id",
  }, successfulFetch);

  assert.deepEqual(result.data, { score: 91 });
  assert.equal(result.requestId, "req_test");
  assert.equal(result.usage.totalTokens, 150);
  assert.equal(capturedBody.store, false);
  assert.equal(capturedBody.text.format.strict, true);
  assert.equal(capturedBody.text.format.type, "json_schema");
  assert.notEqual(capturedBody.safety_identifier, "real-user-id");
  assert.equal(capturedBody.safety_identifier.length, 32);

  const refusalFetch = async () => new Response(JSON.stringify({
    id: "resp_refusal",
    model: "test-model",
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "refusal", refusal: "Cannot process this request." }],
    }],
  }), { status: 200 });

  await assert.rejects(
    () => generateStructuredJson(config, {
      schemaName: "test_refusal",
      schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
      systemPrompt: "Return a result.",
      payload: {},
      userId: "user",
    }, refusalFetch),
    (error) => error instanceof AiProviderError && error.code === "model_refusal",
  );

  const registeredHandlers = [];
  globalThis.Deno = {
    env: {
      get: () => undefined,
      toObject: () => ({}),
    },
    serve: (handler) => registeredHandlers.push(handler),
  };
  await vite.ssrLoadModule("/supabase/functions/review-free-answer/index.ts");
  await vite.ssrLoadModule("/supabase/functions/advise-physical-training/index.ts");
  assert.equal(registeredHandlers.length, 2, "Both Edge Functions must register a handler");
  delete globalThis.Deno;

  console.log("AI provider smoke passed: contract, privacy hash, parsing, refusal and Edge imports.");
} finally {
  await vite.close();
}
