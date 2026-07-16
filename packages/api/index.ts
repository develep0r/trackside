// ============================================================================
// TRACKSIDE — data access layer (lib/api.ts)
// One file, every backend interaction. Import this from both the Expo client
// app and the Next.js trainer console so the two never drift.
//
//   npm i @supabase/supabase-js
//
// Env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (Expo)
//      NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (Next.js)
// ============================================================================
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ---------------------------------------------------------------------------
// Types (mirror the schema)
// ---------------------------------------------------------------------------
export type Role = "client" | "trainer";
export type Goal = "lose_fat" | "build_muscle" | "get_fitter" | "stay_consistent";
export type Sex = "male" | "female" | "other";

export interface ClientProfile {
  id: string; trainer_id: string | null; name: string;
  dob: string | null; sex: Sex | null; goal: Goal | null;
  train_freq: string | null; target_weight: number | null;
  coach_note: string | null; avatar_path: string | null; consented_at: string | null;
}
export interface TrainerProfile {
  id: string; name: string; headline: string | null; years: number | null;
  location: string | null; philosophy: string | null;
  credentials: string[] | null; specialties: string[] | null;
  avatar_path: string | null; gallery_paths: string[]; invite_slug: string;
}
export interface Checkin {
  id: string; client_id: string; date: string;
  weight: number | null; waist: number | null; chest: number | null; arm: number | null;
  energy: number | null; nutrition: number | null; sleep_hrs: number | null;
  workout: boolean; notes: string | null;
}
export interface Feedback {
  id: string; trainer_id: string; client_id: string; body: string;
  ai_assisted: boolean; created_at: string;
  feedback_actions: FeedbackAction[];
}
export interface FeedbackAction { id: string; body: string; done: boolean; }
export interface Invite {
  id: string; trainer_id: string; phone: string; client_name: string | null;
  status: "pending" | "joined" | "revoked"; created_at: string;
}
export interface RosterRow {
  client_id: string; trainer_id: string; name: string; sex: Sex | null; goal: Goal | null;
  age: number | null; logs_7d: number | null; last_log_date: string | null;
  days_since_log: number | null; weight_now: number | null;
  weight_7d_ago: number | null; weight_delta_7d: number | null;
}

// ---------------------------------------------------------------------------
// Auth — phone + OTP (replaces the prototype's demo OTP)
// ---------------------------------------------------------------------------
export const sendOtp = (phoneE164: string) =>
  supabase.auth.signInWithOtp({ phone: phoneE164 });

export const verifyOtp = (phoneE164: string, token: string) =>
  supabase.auth.verifyOtp({ phone: phoneE164, token, type: "sms" });

export const signOut = () => supabase.auth.signOut();

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getMyRole(): Promise<Role | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", uid).single();
  return (data?.role as Role) ?? null;
}

/** Called once at signup — trainer flow sets 'trainer', client flow leaves default. */
export const setMyRole = async (role: Role) => {
  const uid = await getSessionUserId();
  return supabase.from("profiles").update({ role }).eq("id", uid!);
};

// ---------------------------------------------------------------------------
// Media helpers — private bucket + signed URLs, never public
// ---------------------------------------------------------------------------
const BUCKET = "media";

export async function uploadImage(path: string, file: Blob | ArrayBuffer, contentType = "image/jpeg") {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string | null, expiresIn = 60): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Client: onboarding (the 2-minute wizard)
// ---------------------------------------------------------------------------
export async function completeOnboarding(p: {
  name: string; dob?: string; sex?: Sex; goal?: Goal; train_freq?: string;
  target_weight?: number; coach_note?: string; avatarFile?: Blob;
}) {
  const uid = (await getSessionUserId())!;
  let avatar_path: string | undefined;
  // NB: must be avatars/{uid}/... — storage policies key on (storage.foldername(name))[2]
  if (p.avatarFile) avatar_path = await uploadImage(`avatars/${uid}/avatar.jpg`, p.avatarFile);

  const { error } = await supabase.from("client_profiles").upsert({
    id: uid, name: p.name, dob: p.dob ?? null, sex: p.sex ?? null,
    goal: p.goal ?? null, train_freq: p.train_freq ?? null,
    target_weight: p.target_weight ?? null, coach_note: p.coach_note ?? null,
    avatar_path, consented_at: new Date().toISOString(),  // photo/health-data consent captured in UI
  });
  if (error) throw error;
}

export async function getMyClientProfile(): Promise<ClientProfile | null> {
  const uid = await getSessionUserId();
  const { data } = await supabase.from("client_profiles").select("*").eq("id", uid!).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Invites — the ONLY linking path (trainer-driven, per product decision)
// ---------------------------------------------------------------------------
export async function getMyPendingInvites(): Promise<(Invite & { trainer: TrainerProfile | null })[]> {
  const { data, error } = await supabase
    .from("invites")
    .select("*, trainer:trainer_profiles!invites_trainer_id_fkey(*)")
    .eq("status", "pending");
  if (error) throw error;
  return data ?? [];
}

/** Handles both first link and coach switch; server verifies phone match. */
export const acceptInvite = (inviteId: string) =>
  supabase.rpc("accept_invite", { p_invite_id: inviteId });

// ---------------------------------------------------------------------------
// Client: check-ins + photos
// ---------------------------------------------------------------------------
export async function saveCheckin(
  c: Omit<Checkin, "id" | "client_id">,
  photos: { front?: Blob; side?: Blob } = {},
) {
  const uid = (await getSessionUserId())!;
  const { data, error } = await supabase
    .from("checkins")
    .upsert({ ...c, client_id: uid }, { onConflict: "client_id,date" })
    .select("id").single();
  if (error) throw error;

  for (const slot of ["front", "side"] as const) {
    const blob = photos[slot];
    if (!blob) continue;
    const path = await uploadImage(`checkins/${uid}/${data.id}/${slot}.jpg`, blob);
    const { error: pe } = await supabase.from("checkin_photos").upsert(
      { checkin_id: data.id, client_id: uid, slot, storage_path: path },
      { onConflict: "checkin_id,slot" },
    );
    if (pe) throw pe;
  }
  return data.id;
}

export async function getCheckins(clientId?: string): Promise<Checkin[]> {
  const id = clientId ?? (await getSessionUserId())!;   // trainers pass a client_id; RLS enforces access
  const { data, error } = await supabase
    .from("checkins").select("*").eq("client_id", id).order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCheckinPhotoUrls(checkinId: string) {
  const { data } = await supabase.from("checkin_photos").select("slot, storage_path").eq("checkin_id", checkinId);
  const out: Record<string, string | null> = {};
  for (const row of data ?? []) out[row.slot] = await signedUrl(row.storage_path);
  return out;
}

// ---------------------------------------------------------------------------
// Feedback (both sides)
// ---------------------------------------------------------------------------
export async function getFeedback(clientId?: string): Promise<Feedback[]> {
  const id = clientId ?? (await getSessionUserId())!;
  const { data, error } = await supabase
    .from("feedback").select("*, feedback_actions(*)")
    .eq("client_id", id).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const toggleAction = (actionId: string, done: boolean) =>
  supabase.from("feedback_actions").update({ done }).eq("id", actionId);

export async function sendFeedback(clientId: string, body: string, actions: string[], aiAssisted = false) {
  const uid = (await getSessionUserId())!;
  const { data, error } = await supabase
    .from("feedback").insert({ trainer_id: uid, client_id: clientId, body, ai_assisted: aiAssisted })
    .select("id").single();
  if (error) throw error;
  if (actions.length) {
    const { error: ae } = await supabase.from("feedback_actions")
      .insert(actions.map((a) => ({ feedback_id: data.id, client_id: clientId, body: a })));
    if (ae) throw ae;
  }
  return data.id;
}

// ---------------------------------------------------------------------------
// Trainer console
// ---------------------------------------------------------------------------
export async function getRoster(): Promise<RosterRow[]> {
  const { data, error } = await supabase.from("roster_stats").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function createInvite(phoneE164: string, clientName?: string) {
  const uid = (await getSessionUserId())!;
  return supabase.from("invites").insert({ trainer_id: uid, phone: phoneE164, client_name: clientName ?? null });
  // a database webhook on this table fires the send-invite edge function (SMS/WhatsApp)
}

export async function getSentInvites(): Promise<Invite[]> {
  const uid = (await getSessionUserId())!;
  const { data } = await supabase.from("invites").select("*").eq("trainer_id", uid).order("created_at", { ascending: false });
  return data ?? [];
}

export const revokeInvite = (inviteId: string) =>
  supabase.from("invites").update({ status: "revoked", responded_at: new Date().toISOString() }).eq("id", inviteId);

export async function saveTrainerPage(p: Partial<TrainerProfile> & { avatarFile?: Blob; galleryFiles?: Blob[] }) {
  const uid = (await getSessionUserId())!;
  const patch: Record<string, unknown> = { id: uid, ...p };
  delete patch.avatarFile; delete patch.galleryFiles;

  if (p.avatarFile) patch.avatar_path = await uploadImage(`trainer/${uid}/avatar.jpg`, p.avatarFile);
  if (p.galleryFiles?.length) {
    const paths: string[] = [];
    for (let i = 0; i < p.galleryFiles.length; i++) {
      paths.push(await uploadImage(`trainer/${uid}/gallery/${i}.jpg`, p.galleryFiles[i]));
    }
    patch.gallery_paths = paths;
  }
  const { error } = await supabase.from("trainer_profiles").upsert(patch);
  if (error) throw error;
}

export async function getTrainerPage(trainerId: string): Promise<TrainerProfile | null> {
  const { data } = await supabase.from("trainer_profiles").select("*").eq("id", trainerId).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// AI feedback draft — call your own edge function, NOT Anthropic from the app
// (keeps the API key server-side; function fetches the week's data itself
//  using the trainer's JWT so RLS still applies)
// ---------------------------------------------------------------------------
export async function draftFeedbackWithAI(clientId: string): Promise<{ text: string; actions: string[] }> {
  const { data, error } = await supabase.functions.invoke("draft-feedback", { body: { client_id: clientId } });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// DPDP: account deletion — server-side purge (storage + auth user)
// ---------------------------------------------------------------------------
export const deleteMyAccount = () => supabase.functions.invoke("delete-account");
