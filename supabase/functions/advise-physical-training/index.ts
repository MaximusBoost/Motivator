import { createClient } from "@supabase/supabase-js";
import {
  AiProviderError,
  generateStructuredJson,
  readOpenAiConfig,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateAdvice(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("AI provider returned invalid JSON");
  const advice = value as {
    summary?: unknown;
    recommendations?: unknown;
    caution?: unknown;
  };
  const summary = cleanText(advice.summary, 1600);
  const caution = cleanText(advice.caution, 1200);
  const recommendations = Array.isArray(advice.recommendations)
    ? advice.recommendations
        .map((item) => cleanText(item, 500))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  if (!summary || !caution || recommendations.length === 0) {
    throw new Error("AI provider omitted required advice fields");
  }
  return { summary, recommendations, caution };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server environment is incomplete");
    const aiConfig = readOpenAiConfig(Deno.env.toObject());

    const authorization = request.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "Authentication required" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: "Invalid session" }, 401);

    const payload = await request.json() as { resultId?: unknown };
    const resultId = cleanText(payload.resultId, 80);
    if (!resultId) return jsonResponse({ error: "resultId is required" }, 400);

    const { data: selectedResult, error: selectedError } = await admin
      .from("user_practice_results")
      .select("id,user_id,category,title,value,unit,grade,performed_at")
      .eq("id", resultId)
      .eq("user_id", userData.user.id)
      .eq("category", "physical")
      .maybeSingle();
    if (selectedError) throw selectedError;
    if (!selectedResult) return jsonResponse({ error: "Physical result not found" }, 404);

    const { data: existingAdvice, error: existingError } = await admin
      .from("physical_training_advice")
      .select("id,generated_at")
      .eq("user_id", userData.user.id)
      .eq("based_on_result_id", selectedResult.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingAdvice) {
      return jsonResponse({
        adviceId: existingAdvice.id,
        resultId: selectedResult.id,
        generatedAt: existingAdvice.generated_at,
        status: "already_generated",
      });
    }

    const { data: history, error: historyError } = await admin
      .from("user_practice_results")
      .select("id,title,value,unit,grade,performed_at")
      .eq("user_id", userData.user.id)
      .eq("category", "physical")
      .lte("performed_at", selectedResult.performed_at)
      .order("performed_at", { ascending: false })
      .limit(5);
    if (historyError) throw historyError;

    const generated = await generateStructuredJson<unknown>(aiConfig, {
      schemaName: "physical_training_advice",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          recommendations: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
          caution: { type: "string" },
        },
        required: ["summary", "recommendations", "caution"],
        additionalProperties: false,
      },
      systemPrompt: [
        "Ты формируешь краткую учебную обратную связь по самостоятельно внесенным результатам физической подготовки.",
        "Используй только переданные числовые результаты и оценки, не выдумывай возраст, пол, состояние здоровья или условия выполнения.",
        "Предлагай постепенные и безопасные общие шаги, а не официальный индивидуальный план.",
        "Не ставь диагнозы, не назначай лечение, препараты, экстремальные нагрузки, допинг или действия через боль.",
        "Не интерпретируй заметки и не запрашивай подразделение, место службы, ВУС или личность.",
        "При боли, резком ухудшении самочувствия или иных признаках риска рекомендуй прекратить нагрузку и обратиться к специалисту.",
      ].join(" "),
      payload: {
        latestResult: {
          title: selectedResult.title,
          value: selectedResult.value,
          unit: selectedResult.unit,
          grade: selectedResult.grade,
          performedAt: selectedResult.performed_at,
        },
        recentResults: (history ?? []).map((result) => ({
          title: result.title,
          value: result.value,
          unit: result.unit,
          grade: result.grade,
          performedAt: result.performed_at,
        })),
      },
      userId: userData.user.id,
      maxOutputTokens: 1000,
    });
    const advice = validateAdvice(generated.data);

    const { data: savedAdvice, error: saveError } = await admin
      .from("physical_training_advice")
      .upsert(
        {
          user_id: userData.user.id,
          based_on_result_id: selectedResult.id,
          summary: advice.summary,
          recommendations: advice.recommendations,
          caution: advice.caution,
          source: "ai",
          generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,based_on_result_id" },
      )
      .select("id,generated_at")
      .single();
    if (saveError) throw saveError;

    return jsonResponse({
      adviceId: savedAdvice.id,
      resultId: selectedResult.id,
      generatedAt: savedAdvice.generated_at,
      provider: generated.provider,
      model: generated.model,
      responseId: generated.responseId,
      usage: generated.usage,
    });
  } catch (error) {
    if (error instanceof AiProviderError) {
      console.error("advise-physical-training provider error", {
        code: error.code,
        status: error.status,
        requestId: error.requestId,
      });
      return jsonResponse({
        error: error.code === "provider_not_configured"
          ? "AI advice is not configured"
          : "AI advice is temporarily unavailable",
        code: error.code,
        retryable: error.retryable,
      }, error.code === "provider_not_configured" ? 503 : 502);
    }
    console.error("advise-physical-training failed", error);
    return jsonResponse({ error: "Advice generation failed" }, 500);
  }
});
