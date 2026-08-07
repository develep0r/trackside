// ============================================================================
// supabase/functions/delete-account/index.ts
// DPDP right-to-erasure. Verifies the caller, purges their storage prefixes
// (DB cascades don't touch storage!), then deletes the auth user — which
// cascades through profiles → all their rows.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, handleCorsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response("unauthorized", { status: 401, headers: CORS_HEADERS });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // purge every storage prefix this user can own
    for (const prefix of [`checkins/${user.id}`, `avatars/${user.id}`, `trainer/${user.id}`]) {
      let page: string[] = [];
      do {
        const { data } = await admin.storage.from("media").list(prefix, { limit: 100 });
        page = (data ?? []).map((f) => `${prefix}/${f.name}`);
        // nested folders (checkins/{uid}/{checkin_id}/...) need one more level
        for (const f of data ?? []) {
          if (!f.id) { // folder
            const { data: inner } = await admin.storage.from("media").list(`${prefix}/${f.name}`, { limit: 100 });
            page.push(...(inner ?? []).map((g) => `${prefix}/${f.name}/${g.name}`));
          }
        }
        if (page.length) await admin.storage.from("media").remove(page);
      } while (page.length === 100);
    }

    // delete auth user → cascades to profiles → everything else
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return new Response("deleted", { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500, headers: CORS_HEADERS });
  }
});
