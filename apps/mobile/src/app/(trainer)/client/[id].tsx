import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  draftFeedbackWithAI, getCheckins, getFeedback, sendFeedback,
  type Checkin, type Feedback,
} from "@trackside/api";
import { T } from "../../../lib/theme";

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function ClientDetail() {
  const { id, name, goal, days } = useLocalSearchParams<{
    id: string; name?: string; goal?: string; days?: string;
  }>();

  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState("");

  // composer state
  const [body, setBody] = useState("");
  const [actions, setActions] = useState<string[]>([""]);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, f] = await Promise.all([getCheckins(id), getFeedback(id)]);
      setCheckins(c);
      setFeedback(f);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load client data");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const recent = useMemo(() => [...checkins].reverse(), [checkins]); // newest first
  const trend = useMemo(() => {
    const pts = checkins.filter((c) => c.weight != null).slice(-30);
    if (pts.length < 2) return null;
    const ws = pts.map((c) => c.weight as number);
    const min = Math.min(...ws), max = Math.max(...ws);
    return { pts, min, max, span: Math.max(max - min, 0.5) };
  }, [checkins]);

  const daysSilent = days ? parseInt(days, 10) : NaN;

  const onDraft = async () => {
    if (!id) return;
    setDrafting(true); setDraftError("");
    try {
      const d = await draftFeedbackWithAI(id);
      setBody(d.text);
      setActions(d.actions.length ? d.actions : [""]);
      setAiAssisted(true);
    } catch {
      setDraftError("AI draft unavailable right now — write it manually or try again.");
    } finally {
      setDrafting(false);
    }
  };

  const onSend = async () => {
    if (!id || !body.trim()) { setDraftError("Write (or draft) the feedback first."); return; }
    setSending(true); setDraftError("");
    try {
      await sendFeedback(id, body.trim(), actions.map((a) => a.trim()).filter(Boolean), aiAssisted);
      setBody(""); setActions([""]); setAiAssisted(false);
      setSentAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      await load();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Couldn't send — try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.back}>← All clients</Text>
          </Pressable>

          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{(name || "Client").toUpperCase()}</Text>
              {!!goal && <Text style={s.meta}>{String(goal).replace(/_/g, " ")}</Text>}
            </View>
            {Number.isFinite(daysSilent) && daysSilent >= 3 && (
              <Text style={s.flag}>{daysSilent}d silent</Text>
            )}
          </View>

          {!!error && <Text style={s.error}>{error}</Text>}

          {/* Weight trend — dependency-free sparkline (bars scaled to min/max) */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>WEIGHT TREND (KG)</Text>
            {trend ? (
              <>
                <View style={s.sparkRow}>
                  {trend.pts.map((c) => {
                    const h = 8 + ((c.weight! - trend.min) / trend.span) * 52;
                    return <View key={c.id} style={[s.sparkBar, { height: h }]} />;
                  })}
                </View>
                <View style={s.sparkLabels}>
                  <Text style={s.sparkLabel}>{fmtDay(trend.pts[0].date)}</Text>
                  <Text style={s.sparkLabel}>
                    {trend.min} – {trend.max} kg
                  </Text>
                  <Text style={s.sparkLabel}>{fmtDay(trend.pts[trend.pts.length - 1].date)}</Text>
                </View>
              </>
            ) : (
              <Text style={s.empty}>Not enough weigh-ins yet.</Text>
            )}
          </View>

          {/* Check-in history */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>CHECK-INS</Text>
            {recent.length === 0 && <Text style={s.empty}>No check-ins yet.</Text>}
            {recent.slice(0, 14).map((c) => (
              <View key={c.id} style={s.checkinRow}>
                <Text style={s.checkinDate}>{fmtDay(c.date)}</Text>
                <Text style={s.checkinMeta}>
                  {c.weight != null ? `${c.weight} kg` : "—"}
                  {c.energy != null ? ` · E${c.energy}` : ""}
                  {` · ${c.workout ? "trained" : "rest"}`}
                  {c.notes ? " · 📝" : ""}
                </Text>
              </View>
            ))}
          </View>

          {/* Composer */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>SEND FEEDBACK</Text>
            <TextInput
              style={[s.input, s.multiline]}
              multiline value={body}
              onChangeText={(v) => setBody(v)}
              placeholder="How was their week? Keep it specific and encouraging…"
              placeholderTextColor={T.sub}
            />
            <Text style={s.label}>ACTION ITEMS</Text>
            {actions.map((a, i) => (
              <View key={i} style={s.actionRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={a}
                  onChangeText={(v) => setActions(actions.map((x, j) => (j === i ? v : x)))}
                  placeholder={`Action ${i + 1}`}
                  placeholderTextColor={T.sub}
                />
                <Pressable onPress={() => setActions(actions.filter((_, j) => j !== i))}>
                  <Text style={s.remove}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setActions([...actions, ""])}>
              <Text style={s.addAction}>+ Add action</Text>
            </Pressable>

            {aiAssisted && (
              <Text style={s.aiNote}>✨ AI-drafted — review and edit before sending (marked as AI-assisted).</Text>
            )}
            {!!draftError && <Text style={s.error}>{draftError}</Text>}
            {sentAt && <Text style={s.sent}>Sent ✓ {sentAt}</Text>}

            <View style={s.btnRow}>
              <Pressable style={[s.btnGhost, drafting && s.btnDisabled]} disabled={drafting} onPress={onDraft}>
                <Text style={s.btnGhostText}>{drafting ? "Drafting…" : "✨ Draft with AI"}</Text>
              </Pressable>
              <Pressable style={[s.btn, sending && s.btnDisabled]} disabled={sending} onPress={onSend}>
                <Text style={s.btnText}>{sending ? "Sending…" : "Send to client"}</Text>
              </Pressable>
            </View>
          </View>

          {/* Feedback history */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>FEEDBACK HISTORY</Text>
            {feedback.length === 0 && <Text style={s.empty}>Nothing sent yet.</Text>}
            {feedback.map((f) => (
              <View key={f.id} style={s.feedbackItem}>
                <Text style={s.feedbackDate}>
                  {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {f.ai_assisted ? " · ✨ AI-assisted" : ""}
                </Text>
                <Text style={s.feedbackBody}>{f.body}</Text>
                {f.feedback_actions?.map((a) => (
                  <Text key={a.id} style={s.actionItem}>
                    {a.done ? "☑" : "☐"} {a.body}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  back: { color: T.pine, fontSize: 14, fontWeight: "600", marginBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  name: { fontSize: 22, fontWeight: "700", color: T.ink, letterSpacing: 0.5 },
  meta: { fontSize: 13, color: T.sub, marginTop: 2, textTransform: "capitalize" },
  flag: {
    fontSize: 11, fontWeight: "600", color: T.lane, backgroundColor: T.laneSoft,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden",
  },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 10 },
  sparkRow: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 64 },
  sparkBar: { flex: 1, maxWidth: 14, borderRadius: 3, backgroundColor: T.pineSoft, borderWidth: 1, borderColor: T.pine },
  sparkLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  sparkLabel: { fontSize: 10, color: T.sub },
  empty: { fontSize: 13, color: T.sub },
  checkinRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  checkinDate: { fontSize: 13, fontWeight: "600", color: T.ink },
  checkinMeta: { fontSize: 13, color: T.sub },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 12, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 15, backgroundColor: "#FBFBF9", color: T.ink,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  remove: { color: T.sub, fontSize: 16, padding: 4 },
  addAction: { color: T.pine, fontSize: 13, fontWeight: "600", marginTop: 2 },
  aiNote: { fontSize: 12, color: T.teal, marginTop: 10 },
  error: { fontSize: 13, color: T.lane, marginTop: 10 },
  sent: { fontSize: 13, color: T.pine, fontWeight: "600", marginTop: 10 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, backgroundColor: T.pine, borderRadius: 12, padding: 13, alignItems: "center" },
  btnGhost: {
    flex: 1, borderRadius: 12, padding: 13, alignItems: "center",
    borderWidth: 1.5, borderColor: T.pine, backgroundColor: "transparent",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnGhostText: { color: T.pine, fontSize: 14, fontWeight: "600" },
  feedbackItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  feedbackDate: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, color: T.sub, marginBottom: 4 },
  feedbackBody: { fontSize: 14, color: T.ink, lineHeight: 20 },
  actionItem: { fontSize: 13, color: T.sub, marginTop: 4 },
});
