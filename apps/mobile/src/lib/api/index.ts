// ============================================================================
// API facade — the app imports everything from here, never from
// @trackside/api directly. EXPO_PUBLIC_MOCK_API=1 swaps in the mock backend
// (see ./mock.ts) so the whole app runs with zero Supabase configuration.
// ============================================================================
import * as real from "@trackside/api";
import * as mock from "./mock";

export const MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_API === "1";
export const MOCK_OTP = mock.MOCK_OTP;

export * from "@trackside/api"; // types (interfaces are erased at runtime)

// Pick a function from the active backend, keeping the real signature.
const pick = <K extends keyof typeof real>(k: K): (typeof real)[K] =>
  MOCK_MODE && k in mock ? ((mock as Record<string, unknown>)[k] as (typeof real)[K]) : real[k];

export const initApi = pick("initApi");
export const sendOtp = pick("sendOtp");
export const verifyOtp = pick("verifyOtp");
export const signOut = pick("signOut");
export const getSessionUserId = pick("getSessionUserId");
export const getMyRole = pick("getMyRole");
export const getMyClientProfile = pick("getMyClientProfile");
export const completeOnboarding = pick("completeOnboarding");
export const getMyPendingInvites = pick("getMyPendingInvites");
export const acceptInvite = pick("acceptInvite");
export const getCheckins = pick("getCheckins");
export const saveCheckin = pick("saveCheckin");
export const getFeedback = pick("getFeedback");
export const toggleAction = pick("toggleAction");
export const sendFeedback = pick("sendFeedback");
export const draftFeedbackWithAI = pick("draftFeedbackWithAI");
export const getRoster = pick("getRoster");
export const createInvite = pick("createInvite");
export const getSentInvites = pick("getSentInvites");
export const revokeInvite = pick("revokeInvite");
export const getTrainerPage = pick("getTrainerPage");
export const saveTrainerPage = pick("saveTrainerPage");

/**
 * Auth-change subscription with one shape for both backends.
 * Returns an unsubscribe function.
 */
export function onAuthChange(cb: (userId: string | null) => void): () => void {
  if (MOCK_MODE) return mock.onAuthChange(cb);
  const { data } = real.supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.id ?? null));
  return () => data.subscription.unsubscribe();
}

/** Demo helper (mock mode only): wipe and reseed the fake world. */
export const resetMockDb = mock.resetMockDb;
