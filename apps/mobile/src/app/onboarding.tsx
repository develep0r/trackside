import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  acceptInvite, completeOnboarding, errorMessage, getMyPendingInvites,
  type Goal, type Invite, type Sex, type TrainerProfile,
} from "@/lib/api";
import { T } from "../lib/theme";

const GOALS: { key: Goal; label: string }[] = [
  { key: "lose_fat", label: "Lose fat" },
  { key: "build_muscle", label: "Build muscle" },
  { key: "get_fitter", label: "Get fitter" },
  { key: "stay_consistent", label: "Stay consistent" },
];
const SEXES: { key: Sex; label: string }[] = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "other", label: "Other" },
];
const FREQS = ["1-2", "3-4", "5+"];

type PendingInvite = Invite & { trainer: TrainerProfile | null };

export default function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [goal, setGoal] = useState<Goal | "">("");
  const [freq, setFreq] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  const next = () => {
    if (!name.trim()) { setError("Just your name — everything else is optional."); return; }
    setError(""); setStep(2);
  };

  const finish = async () => {
    if (!consent) {
      setError("Please consent to sharing your progress data with your coach to continue.");
      return;
    }
    setError(""); setSaving(true);
    try {
      // dob is approximated from age (Jan 1) — the roster only shows years.
      const yr = new Date().getFullYear();
      const ageN = parseInt(age, 10);
      await completeOnboarding({
        name: name.trim(),
        dob: Number.isFinite(ageN) && ageN >= 18 && ageN < 100 ? `${yr - ageN}-01-01` : undefined,
        sex: sex || undefined,
        goal: goal || undefined,
        train_freq: freq || undefined,
        target_weight: targetWeight ? parseFloat(targetWeight) : undefined,
        coach_note: note.trim() || undefined,
      });
      const invites = await getMyPendingInvites();
      if (invites.length > 0) {
        setInvite(invites[0]);
        setDone(true);
      } else {
        router.replace("/(client)/home");
      }
    } catch (e) {
      const msg = errorMessage(e, "Couldn't save your profile.");
      // The server rejects uninvited signups (invite-only) — translate the RLS error.
      setError(
        /row-level security|policy/i.test(msg)
          ? "This number hasn't been invited yet. Trackside is invite-only — ask your coach to send you an invite."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const onAccept = async () => {
    if (!invite) return;
    setAccepting(true); setError("");
    const { error: err } = await acceptInvite(invite.id);
    setAccepting(false);
    if (err) { setError(err.message); return; }
    router.replace("/(client)/home");
  };

  const Chips = <V extends string>({ options, value, onPick }: {
    options: { key: V; label: string }[]; value: V | ""; onPick: (v: V | "") => void;
  }) => (
    <View style={s.chipRow}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={[s.chip, value === o.key && s.chipOn]}
          onPress={() => onPick(value === o.key ? "" : o.key)}
        >
          <Text style={[s.chipText, value === o.key && s.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (done && invite) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={[s.card, { marginTop: 40 }]}>
          <Text style={s.emoji}>🤝</Text>
          <Text style={s.title}>YOU'RE INVITED</Text>
          <Text style={s.hint}>
            Coach {invite.trainer?.name || "your coach"} invited you to Trackside. Accept to be
            connected — they'll see your daily check-ins and send you weekly feedback.
          </Text>
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable style={[s.btn, accepting && s.btnDisabled]} disabled={accepting} onPress={onAccept}>
            <Text style={s.btnText}>{accepting ? "Connecting…" : `Join Coach ${invite.trainer?.name?.split(" ")[0] ?? ""}`}</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/(client)/home")}>
            <Text style={s.skip}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={s.stepLabel}>STEP {step} OF 2 · TAKES UNDER A MINUTE</Text>

          {step === 1 ? (
            <View style={s.card}>
              <Text style={s.title}>ABOUT YOU</Text>
              <Text style={s.label}>YOUR NAME</Text>
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="e.g. Priya Sharma" placeholderTextColor={T.sub} autoFocus />
              <Text style={s.label}>AGE (OPTIONAL)</Text>
              <TextInput style={s.input} value={age} keyboardType="number-pad" maxLength={2}
                onChangeText={(v) => setAge(v.replace(/\D/g, ""))} placeholder="e.g. 29"
                placeholderTextColor={T.sub} />
              <Text style={s.label}>SEX (OPTIONAL)</Text>
              <Chips options={SEXES} value={sex} onPick={setSex} />
              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable style={s.btn} onPress={next}>
                <Text style={s.btnText}>Next → your goal</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.title}>YOUR GOAL</Text>
              <Text style={s.label}>WHAT ARE YOU WORKING TOWARDS?</Text>
              <Chips options={GOALS} value={goal} onPick={setGoal} />
              <Text style={s.label}>TRAINING DAYS PER WEEK</Text>
              <Chips options={FREQS.map((f) => ({ key: f, label: f }))} value={freq} onPick={(v) => setFreq(v || "")} />
              <Text style={s.label}>TARGET WEIGHT KG (OPTIONAL)</Text>
              <TextInput style={s.input} value={targetWeight} keyboardType="decimal-pad" maxLength={5}
                onChangeText={(v) => setTargetWeight(v.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 62" placeholderTextColor={T.sub} />
              <Text style={s.label}>ANYTHING YOUR COACH SHOULD KNOW? (OPTIONAL)</Text>
              <TextInput style={[s.input, s.multiline]} value={note} onChangeText={setNote} multiline
                placeholder="old knee injury, vegetarian…" placeholderTextColor={T.sub} />

              <Pressable style={s.consentRow} onPress={() => setConsent(!consent)}>
                <View style={[s.checkbox, consent && s.checkboxOn]}>
                  {consent && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.consentText}>
                  I consent to sharing my progress data and photos with my coach. Only my current
                  coach can see them, and I can delete everything at any time.
                </Text>
              </Pressable>

              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable style={[s.btn, saving && s.btnDisabled]} disabled={saving} onPress={finish}>
                <Text style={s.btnText}>{saving ? "Saving…" : "Finish setup"}</Text>
              </Pressable>
              <Pressable onPress={() => { setStep(1); setError(""); }}>
                <Text style={s.skip}>← Back</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg, padding: 16 },
  stepLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 10 },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16,
  },
  emoji: { fontSize: 32, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 10 },
  hint: { fontSize: 13, color: T.sub, lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 12, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 16, backgroundColor: "#FBFBF9", color: T.ink,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1.5, borderColor: T.line, backgroundColor: "#FBFBF9",
  },
  chipOn: { backgroundColor: T.pine, borderColor: T.pine },
  chipText: { fontSize: 14, color: T.ink, fontWeight: "500" },
  chipTextOn: { color: "#fff" },
  consentRow: { flexDirection: "row", gap: 10, marginTop: 16, alignItems: "flex-start" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.line,
    alignItems: "center", justifyContent: "center", backgroundColor: "#FBFBF9", marginTop: 2,
  },
  checkboxOn: { backgroundColor: T.pine, borderColor: T.pine },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  consentText: { flex: 1, fontSize: 12, color: T.sub, lineHeight: 17 },
  error: { fontSize: 13, color: T.lane, marginTop: 12 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 14 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  skip: { textAlign: "center", color: T.sub, fontSize: 13, marginTop: 12, textDecorationLine: "underline" },
});
