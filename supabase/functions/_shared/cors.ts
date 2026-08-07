// Functions invoked directly from the browser (supabase.functions.invoke)
// need this, since fetch() sends a CORS preflight OPTIONS request first.
// These functions do their own JWT verification in code (not via the
// platform's verify_jwt config), because verify_jwt=true rejects the
// preflight itself — it has no Authorization header to check — before the
// function ever runs.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function handleCorsPreflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { headers: CORS_HEADERS }) : null;
}
