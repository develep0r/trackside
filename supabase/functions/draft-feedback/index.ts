// ============================================================================
// supabase/functions/draft-feedback/index.ts
// Trainer asks for an AI draft. The Anthropic key stays server-side; client
// data is fetched with the CALLER'S JWT so RLS proves this trainer actually
// coaches this client — the function can't be used to mine other rosters.
//
// Hardening:
//   - per-trainer daily cap (ai_draft_usage + increment_ai_draft RPC, service
//     role only) so a stolen JWT can't burn the Anthropic budget
//   - Anthropic non-200s and malformed/refusal responses return a 502 with a
//     stable error body instead of a raw JSON.parse 500
//
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, handleCorsPreflight } from "../_shared/cors.ts";

const DAILY_DRAFT_LIMIT = 50;
const MAX_TEXT_CHARS = 2000;
const MAX_ACTION_CHARS = 200;
const MAX_ACTIONS = 5;

type Draft = { text: string; actions: string[] };

// The model is told to reply with {"text": ..., "actions": [...]} but nothing
// guarantees it does (refusals, truncation, stray prose). Never trust the
// shape: validate and clamp before returning it to the app.
function validateDraft(raw: string): Draft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const { text, actions } = parsed as Record<string, unknown>;
  if (typeof text !== "string" || text.trim().length === 0) return null;
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > MAX_ACTIONS) return null;
  if (!actions.every((a) => typeof a === "string" && a.trim().length > 0)) return null;
  return {
    text: text.trim().slice(0, MAX_TEXT_CHARS),
    actions: (actions as string[]).map((a) => a.trim().slice(0, MAX_ACTION_CHARS)),
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

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

    // --- rate limit: count this draft against the caller's daily cap -------
    // Resolve the trainer from the JWT (never from the request body) and
    // increment atomically via a service-role-only SECURITY DEFINER RPC.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: used, error: usageErr } = await admin
      .rpc("increment_ai_draft", { p_trainer: userData.user.id });
    if (usageErr) throw usageErr;
    if ((used ?? 0) > DAILY_DRAFT_LIMIT) {
      return json({ error: "daily draft limit reached" }, 429);
    }

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
    if (!res.ok) {
      console.error(`anthropic api error ${res.status}: ${await res.text()}`);
      return json({ error: "draft unavailable, try again" }, 502);
    }

    const data = await res.json();
    const raw = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n")
      .replace(/```json|```/g, "").trim();

    const draft = validateDraft(raw);
    if (!draft) {
      console.error(`anthropic response failed validation (stop_reason=${data.stop_reason}): ${raw.slice(0, 500)}`);
      return json({ error: "draft unavailable, try again" }, 502);
    }
    return json(draft, 200);
  } catch (e) {
    console.error(e);
    return json({ error: "draft failed" }, 500);
  }
});

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
