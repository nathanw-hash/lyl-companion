import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, match_count = 5, match_threshold = 0.3 } = await req.json();
    if (!query) throw new Error("query is required");

    // Generate embedding for the search query via Voyage AI
    const voyageRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + Deno.env.get("VOYAGE_API_KEY"),
      },
      body: JSON.stringify({ input: [query], model: "voyage-3" }),
    });

    if (!voyageRes.ok) {
      const err = await voyageRes.text();
      throw new Error("Voyage AI error: " + err);
    }

    const voyageData = await voyageRes.json();
    const embedding = voyageData.data[0].embedding;

    // Search the knowledge base using the embedding
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabase.rpc("search_knowledge_base", {
      query_embedding: embedding,
      match_threshold,
      match_count,
    });

    if (error) throw new Error("Search error: " + error.message);

    return new Response(JSON.stringify({ results: data, count: data.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
