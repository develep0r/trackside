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
          var2: Deno.env.get("APP_LINK") ?? "https://trackside.in/app",
        }],
      }),
    });
    if (!res.ok) console.error("MSG91 failed:", await res.text());

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
