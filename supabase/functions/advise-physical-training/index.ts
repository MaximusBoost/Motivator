import { createClient } from "@supabase/supabase-js";

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
    const providerUrl = Deno.env.get("AI_PROVIDER_URL") ?? Deno.env.get("AI_REVIEW_URL");
    const providerKey = Deno.env.get("AI_PROVIDER_API_KEY") ?? Deno.env.get("AI_REVIEW_API_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server environment is incomplete");
    if (!providerUrl || !providerKey) return jsonResponse({ error: "AI provider is not configured" }, 503);

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

    const providerResponse = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${providerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "advise_physical_training",
        version: "1.0",
        instructions: [
          "Дай краткие, постепенные и безопасные рекомендации по общей физической подготовке.",
          "Не ставь диагнозы, не назначай лечение и не формируй официальный план подготовки.",
          "Не предлагай экстремальные нагрузки, наказания, допинг или действия через боль.",
          "При признаках риска рекомендуй остановиться и обратиться к профильному специалисту.",
          "Не запрашивай подразделение, место службы, ВУС, личность или иные служебные сведения.",
          "Верни только JSON по указанной схеме.",
        ],
        latestResult: selectedResult,
        recentResults: history ?? [],
        responseSchema: {
          summary: "string",
          recommendations: ["1..5 short strings"],
          caution: "string with safety limitation",
        },
      }),
    });
    if (!providerResponse.ok) {
      throw new Error(`AI provider failed with status ${providerResponse.status}`);
    }
    const advice = validateAdvice(await providerResponse.json());

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
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Advice generation failed" }, 500);
  }
});
