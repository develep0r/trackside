import { useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  acceptInvite, completeOnboarding, errorMessage, getMyPendingInvites,
  type Goal, type Sex,
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

const PICKER_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

export default function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [freq, setFreq] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [note, setNote] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const next = () => {
    if (!name.trim()) { setError("Just your name — everything else is optional."); return; }
    setError(""); setStep(2);
  };

  const toggleGoal = (g: Goal) =>
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const useAsset = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    const blob = await (await fetch(uri)).blob();
    setAvatarFile(blob);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError("Camera permission denied."); return; }
    await useAsset(await ImagePicker.launchCameraAsync(PICKER_OPTS));
  };

  const choosePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission denied."); return; }
    await useAsset(await ImagePicker.launchImageLibraryAsync(PICKER_OPTS));
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
        goal: goals.length ? goals : undefined,
        train_freq: freq || undefined,
        target_weight: targetWeight ? parseFloat(targetWeight) : undefined,
        coach_note: note.trim() || undefined,
        avatarFile: avatarFile ?? undefined,
      });
      // Signup is invite-gated, so completing onboarding always means a
      // pending invite exists — auto-accept it rather than making the user
      // confirm a "choice" that was never really optional. (A later invite
      // from a *different* coach is a real decision — that one is handled
      // separately, on the Coach tab.)
      const invites = await getMyPendingInvites();
      if (invites.length > 0) {
        try { await acceptInvite(invites[0].id); } catch { /* profile is already saved; don't block on this */ }
      }
      router.replace("/(client)/home");
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

  const MultiChips = <V extends string>({ options, value, onToggle }: {
    options: { key: V; label: string }[]; value: V[]; onToggle: (v: V) => void;
  }) => (
    <View style={s.chipRow}>
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <Pressable key={o.key} style={[s.chip, on && s.chipOn]} onPress={() => onToggle(o.key)}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={s.stepLabel}>STEP {step} OF 2 · TAKES UNDER A MINUTE</Text>

          {step === 1 ? (
            <View style={s.card}>
              <Text style={s.title}>ABOUT YOU</Text>
              <Text style={s.label}>PHOTO (OPTIONAL)</Text>
              <View style={s.avatarRow}>
                <Pressable style={s.avatarCircle} onPress={choosePhoto}>
                  {avatarUri
                    ? <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                    : <Text style={s.avatarPlaceholder}>+</Text>}
                </Pressable>
                <View style={s.avatarActions}>
                  <Pressable onPress={takePhoto}><Text style={s.avatarAction}>📷 Take photo</Text></Pressable>
                  <Pressable onPress={choosePhoto}><Text style={s.avatarAction}>🖼 Choose from library</Text></Pressable>
                </View>
              </View>
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
              <Text style={s.label}>WHAT ARE YOU WORKING TOWARDS? (SELECT ALL THAT APPLY)</Text>
              <MultiChips options={GOALS} value={goals} onToggle={toggleGoal} />
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
  title: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 12, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 16, backgroundColor: "#FBFBF9", color: T.ink,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: T.line,
    backgroundColor: "#FBFBF9", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 64, height: 64 },
  avatarPlaceholder: { fontSize: 26, color: T.sub, fontWeight: "300" },
  avatarActions: { gap: 6 },
  avatarAction: { fontSize: 13, color: T.pine, fontWeight: "600" },
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
