// ============================================================================
// supabase/functions/draft-feedback/index.ts
// Trainer asks for an AI draft. The Anthropic key stays server-side; client
// data is fetched with the CALLER'S JWT so RLS proves this trainer actually
// coaches this client — the function can't be used to mine other rosters.
//
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { client_id } = await req.json();
    const authHeader = req.headers.get("Authorization")!;

    // client scoped to the calling trainer's permissions
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const [{ data: profile }, { data: checkins }] = await Promise.all([
      db.from("client_profiles")
        .select("name, sex, goal, train_freq, target_weight, coach_note")
        .eq("id", client_id).maybeSingle(),
      db.from("checkins")
        .select("date, weight, waist, chest, arm, energy, nutrition, sleep_hrs, workout, notes")
        .eq("client_id", client_id).order("date", { ascending: false }).limit(7),
    ]);
    if (!profile) return json({ error: "not your client" }, 403);   // RLS returned nothing
    if (!checkins?.length) return json({ error: "no check-ins yet" }, 400);

    const prompt =
      `You are a fitness coach's assistant. Client profile: ${JSON.stringify(profile)}. ` +
      `Last check-ins (newest first): ${JSON.stringify(checkins)}. ` +
      `Write concise, encouraging, specific coach feedback aligned to their stated goal. ` +
      `Respond ONLY with JSON, no markdown fences: ` +
      `{"text": "2-4 sentence feedback message addressed to the client by first name", ` +
      `"actions": ["3 short actionable items"]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n")
      .replace(/```json|```/g, "").trim();

    return json(JSON.parse(raw), 200);
  } catch (e) {
    console.error(e);
    return json({ error: "draft failed" }, 500);
  }
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
