// ============================================================================
// supabase/functions/razorpay-webhook/index.ts
// Razorpay → trainer_billing.status. Verifies the webhook signature (HMAC
// SHA-256 of the raw body with your webhook secret) before touching anything.
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

Deno.serve(async (req) => {
  const raw = await req.text();

  // --- verify signature ---
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected !== sig) return new Response("bad signature", { status: 401 });

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
    const { error } = await admin.from("trainer_billing").upsert({
      trainer_id: trainerId,
      razorpay_sub_id: sub.id,
      razorpay_customer_id: sub.customer_id ?? null,
      status,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
