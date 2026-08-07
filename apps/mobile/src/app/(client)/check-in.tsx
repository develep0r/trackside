import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage, getCheckins, saveCheckin, type Checkin } from "@/lib/api";
import { T } from "../../lib/theme";

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function CheckIn() {
  const [date, setDate] = useState(isoDay());
  const [existing, setExisting] = useState<Checkin[]>([]);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [arm, setArm] = useState("");
  const [energy, setEnergy] = useState(0);
  const [nutrition, setNutrition] = useState(0);
  const [sleep, setSleep] = useState("");
  const [workout, setWorkout] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setExisting(await getCheckins()); } catch { /* offline: form still usable */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Prefill when a check-in already exists for the selected date.
  useEffect(() => {
    const c = existing.find((x) => x.date === date);
    setWeight(c?.weight != null ? String(c.weight) : "");
    setWaist(c?.waist != null ? String(c.waist) : "");
    setChest(c?.chest != null ? String(c.chest) : "");
    setArm(c?.arm != null ? String(c.arm) : "");
    setEnergy(c?.energy ?? 0);
    setNutrition(c?.nutrition ?? 0);
    setSleep(c?.sleep_hrs != null ? String(c.sleep_hrs) : "");
    setWorkout(c?.workout ?? false);
    setNotes(c?.notes ?? "");
    setSavedAt(null);
  }, [date, existing]);

  const num = (v: string) => (v.trim() === "" ? null : parseFloat(v));

  const onSave = async () => {
    setError(""); setSaving(true);
    try {
      await saveCheckin({
        date,
        weight: num(weight), waist: num(waist), chest: num(chest), arm: num(arm),
        energy: energy || null, nutrition: nutrition || null,
        sleep_hrs: num(sleep), workout, notes: notes.trim() || null,
      });
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      await load();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save — try again."));
    } finally {
      setSaving(false);
    }
  };

  const Rating = ({ value, onPick, label }: { value: number; onPick: (n: number) => void; label: string }) => (
    <>
      <Text style={s.label}>{label}</Text>
      <View style={s.chipRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            testID={`rating-${label.split(" ")[0].toLowerCase()}-${n}`}
            style={[s.rateChip, value === n && s.chipOn]}
            onPress={() => onPick(value === n ? 0 : n)}
          >
            <Text style={[s.chipText, value === n && s.chipTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const Field = ({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder: string;
  }) => (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input} value={value} keyboardType="decimal-pad" maxLength={6}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder} placeholderTextColor={T.sub}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.card}>
            <Text style={s.title}>DAILY CHECK-IN</Text>

            <View style={s.chipRow}>
              {[isoDay(), isoDay(-1)].map((d, i) => (
                <Pressable key={d} style={[s.chip, date === d && s.chipOn]} onPress={() => setDate(d)}>
                  <Text style={[s.chipText, date === d && s.chipTextOn]}>
                    {i === 0 ? `Today · ${fmtDay(d)}` : `Yesterday · ${fmtDay(d)}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={s.row}>
              <Field label="WEIGHT (KG)" value={weight} onChange={setWeight} placeholder="72.4" />
              <Field label="WAIST (CM)" value={waist} onChange={setWaist} placeholder="86" />
            </View>
            <View style={s.row}>
              <Field label="CHEST (CM)" value={chest} onChange={setChest} placeholder="98" />
              <Field label="ARM (CM)" value={arm} onChange={setArm} placeholder="34" />
            </View>

            <Rating label="ENERGY (1-5)" value={energy} onPick={setEnergy} />
            <Rating label="NUTRITION (1-5)" value={nutrition} onPick={setNutrition} />

            <View style={s.row}>
              <Field label="SLEEP (HOURS)" value={sleep} onChange={setSleep} placeholder="7.5" />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TRAINED TODAY?</Text>
                <View style={s.chipRow}>
                  <Pressable style={[s.chip, workout && s.chipOn]} onPress={() => setWorkout(true)}>
                    <Text style={[s.chipText, workout && s.chipTextOn]}>Trained</Text>
                  </Pressable>
                  <Pressable style={[s.chip, !workout && s.chipOn]} onPress={() => setWorkout(false)}>
                    <Text style={[s.chipText, !workout && s.chipTextOn]}>Rest</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Text style={s.label}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[s.input, s.multiline]} value={notes} onChangeText={setNotes} multiline
              placeholder="slept badly, long day at work…" placeholderTextColor={T.sub}
            />

            <View style={s.photoHint}>
              <Text style={s.photoHintText}>📷 Progress photos coming soon</Text>
            </View>

            {!!error && <Text style={s.error}>{error}</Text>}
            {savedAt && <Text style={s.saved}>Saved ✓ {savedAt} — see you tomorrow!</Text>}
            <Pressable style={[s.btn, saving && s.btnDisabled]} disabled={saving} onPress={onSave}>
              <Text style={s.btnText}>
                {saving ? "Saving…" : existing.some((x) => x.date === date) ? "Update check-in" : "Save check-in"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", gap: 12 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 16, backgroundColor: "#FBFBF9", color: T.ink,
  },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1.5, borderColor: T.line, backgroundColor: "#FBFBF9",
  },
  rateChip: {
    width: 44, alignItems: "center", paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: T.line, backgroundColor: "#FBFBF9",
  },
  chipOn: { backgroundColor: T.pine, borderColor: T.pine },
  chipText: { fontSize: 14, color: T.ink, fontWeight: "500" },
  chipTextOn: { color: "#fff" },
  photoHint: {
    backgroundColor: T.pineSoft, borderRadius: 10, padding: 10, marginTop: 16, alignItems: "center",
  },
  photoHintText: { fontSize: 12, color: T.pine, fontWeight: "500" },
  error: { fontSize: 13, color: T.lane, marginTop: 12 },
  saved: { fontSize: 13, color: T.pine, fontWeight: "600", marginTop: 12 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 14 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
