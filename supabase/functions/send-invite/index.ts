// send-invite: fired by a Database Webhook on INSERT into public.invites.
// Guarded by a shared secret header (set the same value in the DB webhook config).
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("INVITE_WEBHOOK_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const payload = await req.json();
    const invite = payload.record;
    if (!invite?.phone) return new Response("no-op", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: tp } = await admin
      .from("trainer_profiles").select("name").eq("id", invite.trainer_id).maybeSingle();
    const coach = tp?.name || "Your coach";

    // MSG91 Flow API (DLT template: var1=coach, var2=link)
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: Deno.env.get("MSG91_AUTHKEY")!,
      },
      body: JSON.stringify({
        template_id: Deno.env.get("MSG91_TEMPLATE_ID")!,
        recipients: [{
          mobiles: invite.phone.replace("+", ""),
          var1: coach,
          var2: Deno.env.get("APP_LINK") ?? "https://trackside.fit/app",
        }],
      }),
    });

    // Record the outcome on the invite row so the coach console can surface
    // failures (delivery_status: queued -> sent | failed). Still return 200
    // either way — the failure is now visible in-product, and a webhook retry
    // would just re-send the same SMS.
    if (invite.id) {
      if (res.ok) {
        await admin.from("invites")
          .update({ delivery_status: "sent", delivered_at: new Date().toISOString() })
          .eq("id", invite.id);
      } else {
        const detail = (await res.text()).slice(0, 500);
        console.error("MSG91 failed:", detail);
        await admin.from("invites")
          .update({ delivery_status: "failed", delivery_error: detail })
          .eq("id", invite.id);
      }
    } else if (!res.ok) {
      console.error("MSG91 failed (no invite id in payload):", (await res.text()).slice(0, 500));
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
