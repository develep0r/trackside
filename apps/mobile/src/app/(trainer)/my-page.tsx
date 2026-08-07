import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { errorMessage, getSessionUserId, getTrainerPage, saveTrainerPage } from "@/lib/api";
import { DeleteAccountButton } from "../../lib/DeleteAccountButton";
import { T } from "../../lib/theme";

export default function MyPage() {
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [years, setYears] = useState("");
  const [location, setLocation] = useState("");
  const [philosophy, setPhilosophy] = useState("");
  const [credentials, setCredentials] = useState("");   // one per line
  const [specialties, setSpecialties] = useState("");   // comma separated
  const [inviteSlug, setInviteSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    (async () => {
      const uid = await getSessionUserId();
      if (!uid) return;
      const p = await getTrainerPage(uid);
      if (!p) return;
      setName(p.name ?? "");
      setHeadline(p.headline ?? "");
      setYears(p.years != null ? String(p.years) : "");
      setLocation(p.location ?? "");
      setPhilosophy(p.philosophy ?? "");
      setCredentials((p.credentials ?? []).join("\n"));
      setSpecialties((p.specialties ?? []).join(", "));
      setInviteSlug(p.invite_slug ?? "");
    })();
  }, []));

  const onSave = async () => {
    if (!name.trim()) { setError("Your name is required — it's on every invite you send."); return; }
    setError(""); setSaving(true);
    try {
      await saveTrainerPage({
        name: name.trim(),
        headline: headline.trim() || null,
        years: years ? parseInt(years, 10) : null,
        location: location.trim() || null,
        philosophy: philosophy.trim() || null,
        credentials: credentials.split("\n").map((c) => c.trim()).filter(Boolean),
        specialties: specialties.split(",").map((c) => c.trim()).filter(Boolean),
      });
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(errorMessage(e, "Couldn't save — try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.card}>
            <Text style={s.title}>MY COACH PAGE</Text>
            <Text style={s.hint}>
              Every client you invite sees this page — it's your brand, not ours.
            </Text>

            <Text style={s.label}>NAME</Text>
            <TextInput style={s.input} value={name} onChangeText={setName}
              placeholder="e.g. Arjun Mehta" placeholderTextColor={T.sub} />

            <Text style={s.label}>HEADLINE</Text>
            <TextInput style={s.input} value={headline} onChangeText={setHeadline}
              placeholder="e.g. Strength & fat-loss coach" placeholderTextColor={T.sub} />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>YEARS COACHING</Text>
                <TextInput style={s.input} value={years} keyboardType="number-pad" maxLength={2}
                  onChangeText={(v) => setYears(v.replace(/\D/g, ""))} placeholder="8" placeholderTextColor={T.sub} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={s.label}>LOCATION</Text>
                <TextInput style={s.input} value={location} onChangeText={setLocation}
                  placeholder="Hyderabad" placeholderTextColor={T.sub} />
              </View>
            </View>

            <Text style={s.label}>PHILOSOPHY</Text>
            <TextInput style={[s.input, s.multiline]} value={philosophy} onChangeText={setPhilosophy} multiline
              placeholder="What clients can expect from working with you…" placeholderTextColor={T.sub} />

            <Text style={s.label}>CREDENTIALS (ONE PER LINE)</Text>
            <TextInput style={[s.input, s.multiline]} value={credentials} onChangeText={setCredentials} multiline
              placeholder={"ACE Certified Personal Trainer\nPrecision Nutrition L1"} placeholderTextColor={T.sub} />

            <Text style={s.label}>SPECIALTIES (COMMA SEPARATED)</Text>
            <TextInput style={s.input} value={specialties} onChangeText={setSpecialties}
              placeholder="Fat loss, Strength, Mobility" placeholderTextColor={T.sub} />

            {!!inviteSlug && (
              <View style={s.slugBox}>
                <Text style={s.slugLabel}>YOUR INVITE LINK</Text>
                <Text style={s.slug}>trackside.fit/j/{inviteSlug}</Text>
              </View>
            )}

            <View style={s.photoHint}>
              <Text style={s.photoHintText}>📷 Profile photo & gallery coming soon</Text>
            </View>

            {!!error && <Text style={s.error}>{error}</Text>}
            {savedAt && <Text style={s.saved}>Saved ✓ {savedAt}</Text>}
            <Pressable style={[s.btn, saving && { opacity: 0.6 }]} disabled={saving} onPress={onSave}>
              <Text style={s.btnText}>{saving ? "Saving…" : "Save page"}</Text>
            </Pressable>
          </View>

          <DeleteAccountButton />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 4 },
  hint: { fontSize: 13, color: T.sub, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 14, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 15, backgroundColor: "#FBFBF9", color: T.ink,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  slugBox: { backgroundColor: T.tealSoft, borderRadius: 10, padding: 12, marginTop: 16 },
  slugLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 1, color: T.teal, marginBottom: 2 },
  slug: { fontSize: 14, fontWeight: "600", color: T.teal },
  photoHint: { backgroundColor: T.pineSoft, borderRadius: 10, padding: 10, marginTop: 12, alignItems: "center" },
  photoHintText: { fontSize: 12, color: T.pine, fontWeight: "500" },
  error: { fontSize: 13, color: T.lane, marginTop: 12 },
  saved: { fontSize: 13, color: T.pine, fontWeight: "600", marginTop: 12 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 14 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
