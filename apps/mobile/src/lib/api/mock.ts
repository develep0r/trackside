// ============================================================================
// MOCK API — full in-app fake of @trackside/api, persisted to AsyncStorage.
// Enabled via EXPO_PUBLIC_MOCK_API=1 (see ./index.ts). Lets every screen be
// built and demoed with zero Supabase configuration.
//
// Demo world:
//   * OTP is always 123456 (shown on the sign-in screen in mock mode)
//   * 9000012345  -> Coach Arjun Mehta with a seeded 3-client roster
//   * any other number -> new client, auto-invited by Arjun (so the
//     invite-gated onboarding + accept flow is fully demoable)
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Checkin, ClientProfile, Feedback, FeedbackAction, Goal, Invite, Role,
  RosterRow, Sex, TrainerProfile,
} from "@trackside/api";
import { normalizePhone } from "@trackside/api";

export const MOCK_OTP = "123456";
const DB_KEY = "trackside:mockdb:v1";
const SESSION_KEY = "trackside:mocksession:v1";

interface MockUser { id: string; phone: string; role: Role; }
interface DB {
  users: MockUser[];
  clientProfiles: ClientProfile[];
  trainerProfiles: TrainerProfile[];
  invites: Invite[];
  checkins: Checkin[];
  feedback: Feedback[];
}

let db: DB | null = null;
let sessionUserId: string | null = null;
let sessionLoaded = false;
const listeners = new Set<(userId: string | null) => void>();

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const uid = () => `m${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
function seedCheckins(clientId: string, days: number, startW: number, loss: number, gapEvery: number, endGap = 0): Checkin[] {
  const out: Checkin[] = [];
  for (let i = days; i >= 1 + endGap; i--) {
    if (gapEvery > 0 && i % gapEvery === 0) continue; // missed days
    const prog = (days - i) / days;
    const wobble = Math.sin(i * 1.7) * 0.4;
    out.push({
      id: `c-${clientId}-${i}`, client_id: clientId, date: isoDay(-i + 1),
      weight: Math.round((startW - loss * prog + wobble) * 10) / 10,
      waist: Math.round((92 - 2.2 * prog) * 10) / 10, chest: null, arm: null,
      energy: 2 + ((i * 3) % 4), nutrition: 2 + ((i * 2) % 4),
      sleep_hrs: 6 + ((i % 3) * 0.75), workout: i % 3 !== 0,
      notes: i % 9 === 0 ? "Long day at work, quick session only" : null,
    });
  }
  return out;
}

function seed(): DB {
  const t1: MockUser = { id: "t1", phone: "919000012345", role: "trainer" };
  const mk = (id: string, phone: string): MockUser => ({ id, phone, role: "client" });
  const c1 = mk("c1", "919000000001"), c2 = mk("c2", "919000000002"), c3 = mk("c3", "919000000003");

  const profile = (u: MockUser, name: string, age: number, sex: Sex, goal: Goal, freq: string, tw: number, note: string): ClientProfile => ({
    id: u.id, trainer_id: "t1", gym_id: null, name,
    dob: `${new Date().getFullYear() - age}-01-01`, sex, goal: [goal], train_freq: freq,
    target_weight: tw, coach_note: note, avatar_path: null,
    consented_at: new Date().toISOString(),
  });

  const feedback: Feedback[] = [{
    id: "f1", trainer_id: "t1", client_id: "c1", ai_assisted: false,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    body: "Priya, solid week — weight is trending the right way and you trained 4 times. Energy dipped midweek; let's protect your sleep on work-travel days.",
    feedback_actions: [
      { id: "fa1", body: "Hit 8,000 steps every day this week", done: false },
      { id: "fa2", body: "Lights out by 11pm on weekdays", done: true },
      { id: "fa3", body: "Add one protein source at breakfast", done: false },
    ],
  }];

  return {
    users: [t1, c1, c2, c3],
    clientProfiles: [
      profile(c1, "Priya Sharma", 34, "female", "stay_consistent", "1-2", 58, "Travels for work"),
      profile(c2, "Vikram Singh", 41, "male", "build_muscle", "3-4", 78, "Old shoulder injury"),
      profile(c3, "Ananya Rao", 29, "female", "lose_fat", "5+", 58, "Vegetarian"),
    ],
    trainerProfiles: [{
      id: "t1", name: "Arjun Mehta", headline: "Strength & fat-loss coach",
      years: 8, location: "Hyderabad",
      philosophy: "Consistency beats intensity. We build habits you can keep for a decade, not a season.",
      credentials: ["ACE Certified Personal Trainer", "Precision Nutrition L1"],
      specialties: ["Fat loss", "Strength", "Desk-worker mobility"],
      avatar_path: null, gallery_paths: [], invite_slug: "arjun",
    }],
    invites: [],
    checkins: [
      ...seedCheckins("c1", 21, 61.8, 2.2, 7, 1),
      ...seedCheckins("c2", 21, 74.6, -1.4, 5, 0),   // building muscle: gaining
      ...seedCheckins("c3", 21, 64.4, 2.8, 0, 4),    // 4 days silent -> attention flag
    ],
    feedback,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
async function load(): Promise<DB> {
  if (db) return db;
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    if (raw) { db = JSON.parse(raw); return db!; }
  } catch { /* fall through to fresh seed */ }
  db = seed();
  await save();
  return db;
}
async function save() {
  if (db) try { await AsyncStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* best effort */ }
}
async function loadSession(): Promise<string | null> {
  if (sessionLoaded) return sessionUserId;
  try { sessionUserId = await AsyncStorage.getItem(SESSION_KEY); } catch { sessionUserId = null; }
  sessionLoaded = true;
  return sessionUserId;
}
async function setSession(id: string | null) {
  sessionUserId = id; sessionLoaded = true;
  try {
    if (id) await AsyncStorage.setItem(SESSION_KEY, id);
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch { /* best effort */ }
  listeners.forEach((l) => l(id));
}

const me = async (): Promise<MockUser | null> => {
  const [d, sid] = await Promise.all([load(), loadSession()]);
  return d.users.find((u) => u.id === sid) ?? null;
};

// ---------------------------------------------------------------------------
// Auth surface
// ---------------------------------------------------------------------------
export const initApi = () => undefined;

let pendingPhone: string | null = null;

export async function sendOtp(phoneE164: string) {
  pendingPhone = normalizePhone(phoneE164);
  return { error: pendingPhone ? null : { message: "Invalid phone number" } };
}

export async function verifyOtp(phoneE164: string, token: string) {
  const phone = normalizePhone(phoneE164) ?? pendingPhone;
  if (!phone) return { error: { message: "Invalid phone number" } };
  if (token !== MOCK_OTP) return { error: { message: `Demo mode — the code is ${MOCK_OTP}` } };

  const d = await load();
  let user = d.users.find((u) => u.phone === phone);
  if (!user) {
    user = { id: uid(), phone, role: "client" };
    d.users.push(user);
    // every fresh number gets a pending invite from the demo coach so the
    // invite-gated onboarding + accept flow is demoable end to end
    d.invites.push({
      id: uid(), trainer_id: "t1", gym_id: null, phone, client_name: null,
      status: "pending", created_at: new Date().toISOString(),
      delivery_status: "sent", delivery_error: null, delivered_at: new Date().toISOString(),
    });
    await save();
  }
  await setSession(user.id);
  return { error: null };
}

export async function signOut() { await setSession(null); return { error: null }; }

export async function deleteMyAccount() {
  const d = await load();
  const u = await me();
  if (!u) return { data: null, error: { message: "not signed in" } };
  d.users = d.users.filter((x) => x.id !== u.id);
  d.clientProfiles = d.clientProfiles.filter((x) => x.id !== u.id);
  d.trainerProfiles = d.trainerProfiles.filter((x) => x.id !== u.id);
  d.checkins = d.checkins.filter((x) => x.client_id !== u.id);
  d.feedback = d.feedback.filter((x) => x.client_id !== u.id && x.trainer_id !== u.id);
  d.invites = d.invites.filter((x) => x.phone !== u.phone);
  await save();
  await setSession(null);
  return { data: null, error: null };
}

export async function getSessionUserId() { return loadSession(); }

export async function getMyRole(): Promise<Role | null> {
  return (await me())?.role ?? null;
}

export function onAuthChange(cb: (userId: string | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export async function getMyClientProfile(): Promise<ClientProfile | null> {
  const [d, u] = [await load(), await me()];
  return d.clientProfiles.find((p) => p.id === u?.id) ?? null;
}

export async function completeOnboarding(p: {
  name: string; dob?: string; sex?: Sex; goal?: Goal[]; train_freq?: string;
  target_weight?: number; coach_note?: string; avatarFile?: unknown;
}) {
  const d = await load();
  const u = await me();
  if (!u) throw new Error("not signed in");
  const invited = d.invites.some((i) => i.phone === u.phone && i.status === "pending");
  const existing = d.clientProfiles.find((c) => c.id === u.id);
  if (!existing && !invited) {
    throw new Error("new row violates row-level security policy"); // mirrors the real invite gate
  }
  const row: ClientProfile = {
    id: u.id, trainer_id: existing?.trainer_id ?? null, gym_id: existing?.gym_id ?? null,
    name: p.name, dob: p.dob ?? null, sex: p.sex ?? null, goal: p.goal ?? null,
    train_freq: p.train_freq ?? null, target_weight: p.target_weight ?? null,
    coach_note: p.coach_note ?? null, avatar_path: null, consented_at: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, row);
  else d.clientProfiles.push(row);
  await save();
}

export async function getMyPendingInvites(): Promise<(Invite & { trainer: TrainerProfile | null })[]> {
  const d = await load();
  const u = await me();
  return d.invites
    .filter((i) => i.phone === u?.phone && i.status === "pending")
    .map((i) => ({ ...i, trainer: d.trainerProfiles.find((t) => t.id === i.trainer_id) ?? null }));
}

export async function acceptInvite(inviteId: string) {
  const d = await load();
  const u = await me();
  const inv = d.invites.find((i) => i.id === inviteId && i.status === "pending");
  if (!u || !inv || inv.phone !== u.phone) return { data: null, error: { message: "invite not found or no longer pending" } };
  const cp = d.clientProfiles.find((c) => c.id === u.id);
  if (!cp) return { data: null, error: { message: "complete onboarding before accepting an invite" } };
  cp.trainer_id = inv.trainer_id;
  cp.gym_id = inv.gym_id;
  inv.status = "joined";
  await save();
  return { data: null, error: null };
}

export async function getCheckins(clientId?: string): Promise<Checkin[]> {
  const d = await load();
  const id = clientId ?? (await me())?.id;
  return d.checkins
    .filter((c) => c.client_id === id)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveCheckin(c: Omit<Checkin, "id" | "client_id">, _photos: unknown = {}) {
  const d = await load();
  const u = await me();
  if (!u) throw new Error("not signed in");
  const existing = d.checkins.find((x) => x.client_id === u.id && x.date === c.date);
  if (existing) Object.assign(existing, c);
  else d.checkins.push({ ...c, id: uid(), client_id: u.id });
  await save();
  return existing?.id ?? "new";
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
export async function getFeedback(clientId?: string): Promise<Feedback[]> {
  const d = await load();
  const id = clientId ?? (await me())?.id;
  return d.feedback
    .filter((f) => f.client_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function toggleAction(actionId: string, done: boolean) {
  const d = await load();
  for (const f of d.feedback) {
    const a = f.feedback_actions.find((x) => x.id === actionId);
    if (a) { a.done = done; await save(); break; }
  }
  return { error: null };
}

export async function sendFeedback(clientId: string, body: string, actions: string[], aiAssisted = false) {
  const d = await load();
  const u = await me();
  if (!u) throw new Error("not signed in");
  const f: Feedback = {
    id: uid(), trainer_id: u.id, client_id: clientId, body,
    ai_assisted: aiAssisted, created_at: new Date().toISOString(),
    feedback_actions: actions.map((a) => ({ id: uid(), body: a, done: false } as FeedbackAction)),
  };
  d.feedback.push(f);
  await save();
  return f.id;
}

export async function draftFeedbackWithAI(clientId: string): Promise<{ text: string; actions: string[] }> {
  const d = await load();
  const cp = d.clientProfiles.find((c) => c.id === clientId);
  const week = d.checkins.filter((c) => c.client_id === clientId).slice(-7);
  await new Promise((r) => setTimeout(r, 900)); // feel like a network call
  const first = cp?.name.split(" ")[0] ?? "there";
  const trained = week.filter((c) => c.workout).length;
  const ws = week.filter((c) => c.weight != null).map((c) => c.weight as number);
  const delta = ws.length >= 2 ? Math.round((ws[ws.length - 1] - ws[0]) * 10) / 10 : 0;
  return {
    text: `${first}, you logged ${week.length} check-ins and trained ${trained} times this week — that consistency is exactly what moves the needle. Weight is ${delta <= 0 ? "down" : "up"} ${Math.abs(delta)} kg over the week, right in line with your goal. Keep the momentum going.`,
    actions: [
      "Log your check-in before 9am each day",
      trained >= 4 ? "Add one mobility session this week" : "Get to 4 training days this week",
      "Aim for 7+ hours of sleep on weeknights",
    ],
  };
}

// ---------------------------------------------------------------------------
// Trainer console
// ---------------------------------------------------------------------------
export async function getRoster(): Promise<RosterRow[]> {
  const d = await load();
  const u = await me();
  const today = isoDay(0);
  return d.clientProfiles
    .filter((c) => c.trainer_id === u?.id)
    .map((c) => {
      const cs = d.checkins.filter((x) => x.client_id === c.id).sort((a, b) => a.date.localeCompare(b.date));
      const latest = cs[cs.length - 1];
      const weekAgoCut = isoDay(-7);
      const weekAgo = [...cs].reverse().find((x) => x.date <= weekAgoCut);
      const logs7 = cs.filter((x) => x.date > weekAgoCut).length;
      const days = latest ? Math.round((+new Date(today) - +new Date(latest.date)) / 86400000) : null;
      return {
        client_id: c.id, trainer_id: c.trainer_id!, name: c.name, sex: c.sex, goal: c.goal,
        age: c.dob ? new Date().getFullYear() - parseInt(c.dob.slice(0, 4), 10) : null,
        logs_7d: logs7, last_log_date: latest?.date ?? null, days_since_log: days,
        weight_now: latest?.weight ?? null, weight_7d_ago: weekAgo?.weight ?? null,
        weight_delta_7d: latest?.weight != null && weekAgo?.weight != null
          ? Math.round((latest.weight - weekAgo.weight) * 10) / 10 : null,
      };
    });
}

export async function createInvite(phone: string, clientName?: string, gymId?: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error(`Invalid phone number: ${phone}`);
  const d = await load();
  const u = await me();
  if (!u) return { error: { message: "not signed in" } };
  if (d.invites.some((i) => i.trainer_id === u.id && i.phone === normalized && i.status === "pending")) {
    return { error: { message: "an invite for this number is already pending" } };
  }
  d.invites.push({
    id: uid(), trainer_id: u.id, gym_id: gymId ?? null, phone: normalized,
    client_name: clientName ?? null, status: "pending", created_at: new Date().toISOString(),
    delivery_status: "sent", delivery_error: null, delivered_at: new Date().toISOString(),
  });
  await save();
  return { error: null };
}

export async function getSentInvites(): Promise<Invite[]> {
  const d = await load();
  const u = await me();
  return d.invites
    .filter((i) => i.trainer_id === u?.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function revokeInvite(inviteId: string) {
  const d = await load();
  const inv = d.invites.find((i) => i.id === inviteId);
  if (inv) { inv.status = "revoked"; await save(); }
  return { error: null };
}

export async function getTrainerPage(trainerId: string): Promise<TrainerProfile | null> {
  const d = await load();
  return d.trainerProfiles.find((t) => t.id === trainerId) ?? null;
}

export async function saveTrainerPage(p: Partial<TrainerProfile> & { avatarFile?: unknown; galleryFiles?: unknown[] }) {
  const d = await load();
  const u = await me();
  if (!u) throw new Error("not signed in");
  const patch = { ...p };
  delete patch.avatarFile; delete patch.galleryFiles;
  const existing = d.trainerProfiles.find((t) => t.id === u.id);
  if (existing) Object.assign(existing, patch);
  else d.trainerProfiles.push({
    id: u.id, name: "", headline: null, years: null, location: null, philosophy: null,
    credentials: null, specialties: null, avatar_path: null, gallery_paths: [],
    invite_slug: u.id, ...patch,
  } as TrainerProfile);
  await save();
}

/** Demo helper: wipe the mock world and reseed. */
export async function resetMockDb() {
  db = seed();
  await save();
}
