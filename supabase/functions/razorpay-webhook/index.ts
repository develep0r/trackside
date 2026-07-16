// ============================================================================
// supabase/functions/razorpay-webhook/index.ts
// Razorpay → trainer_billing.status. Verifies the webhook signature (HMAC
// SHA-256 of the raw body) in constant time via crypto.subtle.verify, and
// dedupes deliveries by x-razorpay-event-id so a redelivered or replayed
// event is applied at most once.
//
//   supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
//   Razorpay dashboard → Webhooks → subscribe to subscription.* events.
//   Store trainer_id in the subscription's `notes` when you create it.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const STATUS_MAP: Record<string, string> = {
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.halted": "past_due",
  "subscription.pending": "past_due",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "cancelled",
};

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

Deno.serve(async (req) => {
  const raw = await req.text();

  // --- verify signature (subtle.verify compares MACs in constant time) ---
  const sig = hexToBytes(req.headers.get("x-razorpay-signature") ?? "");
  if (!sig) return new Response("bad signature", { status: 401 });
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  const valid = await crypto.subtle.verify("HMAC", key, sig, enc.encode(raw));
  if (!valid) return new Response("bad signature", { status: 401 });

  // --- apply event ---
  try {
    const event = JSON.parse(raw);
    const status = STATUS_MAP[event.event];
    if (!status) return new Response("ignored", { status: 200 });

    const sub = event.payload?.subscription?.entity;
    const trainerId = sub?.notes?.trainer_id;
    if (!trainerId) return new Response("no trainer_id in notes", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- idempotency: claim the event id before applying it ---
    const eventId = req.headers.get("x-razorpay-event-id");
    if (eventId) {
      const { error: dupe } = await admin
        .from("webhook_events")
        .insert({ id: eventId, source: "razorpay" });
      if (dupe?.code === "23505") return new Response("duplicate", { status: 200 });
      if (dupe) throw dupe;
    }

    const { error } = await admin.from("trainer_billing").upsert({
      trainer_id: trainerId,
      razorpay_sub_id: sub.id,
      razorpay_customer_id: sub.customer_id ?? null,
      status,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      // release the claim so Razorpay's retry isn't swallowed as a duplicate
      if (eventId) await admin.from("webhook_events").delete().eq("id", eventId);
      throw error;
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
