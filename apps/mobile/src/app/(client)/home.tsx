import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  getCheckins, getFeedback, getMyClientProfile, signOut, toggleAction,
  type Checkin, type ClientProfile, type Feedback,
} from "@/lib/api";
import { DeleteAccountButton } from "../../lib/DeleteAccountButton";
import { T } from "../../lib/theme";

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export default function Home() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c, f] = await Promise.all([getMyClientProfile(), getCheckins(), getFeedback()]);
      setProfile(p); setCheckins(c); setFeedback(f);
    } finally {
      setLoaded(true); setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = isoDay();
  const doneToday = checkins.some((c) => c.date === today);
  // Streak forgiveness: show consistency over the last 7 days, not a fragile
  // consecutive-day count that dies (and demotivates) after one missed day.
  const last7 = useMemo(() => {
    const cut = isoDay(-7);
    return checkins.filter((c) => c.date > cut && c.date <= today).length;
  }, [checkins, today]);

  const latestFeedback = feedback[0];

  const onToggle = async (actionId: string, done: boolean) => {
    setFeedback((fs) => fs.map((f) => ({
      ...f,
      feedback_actions: f.feedback_actions.map((a) => (a.id === actionId ? { ...a, done } : a)),
    })));
    await toggleAction(actionId, done);
  };

  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.pine} />}
      >
        <View style={s.header}>
          <Text style={s.hey}>
            HEY {loaded ? (profile?.name?.split(" ")[0] ?? "THERE").toUpperCase() : "…"}
          </Text>
          <Pressable onPress={async () => { await signOut(); router.replace("/sign-in"); }}>
            <Text style={s.signOut}>Sign out</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.label}>{dateLabel.toUpperCase()}</Text>
          <View style={s.row}>
            <View>
              <Text style={s.big}>{doneToday ? "LOGGED ✓" : "LOG TODAY"}</Text>
              <Text style={s.streak}>
                {last7} of last 7 days logged{last7 >= 5 ? " — great rhythm 🔥" : ""}
              </Text>
            </View>
            <Pressable style={[s.btn, doneToday && s.btnGhostish]} onPress={() => router.push("/(client)/check-in")}>
              <Text style={[s.btnText, doneToday && { color: T.pine }]}>{doneToday ? "Edit" : "Check in"}</Text>
            </Pressable>
          </View>
          <View style={s.weekRow}>
            {[...Array(7)].map((_, i) => {
              const d = isoDay(i - 6);
              const logged = checkins.some((c) => c.date === d);
              return <View key={d} style={[s.dot, logged && s.dotOn]} />;
            })}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>FROM YOUR COACH</Text>
          {latestFeedback ? (
            <>
              <Text style={s.feedbackBody}>{latestFeedback.body}</Text>
              {latestFeedback.ai_assisted && <Text style={s.aiTag}>✨ drafted with AI, reviewed by your coach</Text>}
              {latestFeedback.feedback_actions.map((a) => (
                <Pressable key={a.id} style={s.actionRow} onPress={() => onToggle(a.id, !a.done)}>
                  <View style={[s.checkbox, a.done && s.checkboxOn]}>
                    {a.done && <Text style={s.checkmark}>✓</Text>}
                  </View>
                  <Text style={[s.actionText, a.done && s.actionDone]}>{a.body}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <Text style={s.text}>No feedback yet. Keep logging — your coach reviews your check-ins here.</Text>
          )}
        </View>

        {loaded && !profile && (
          <View style={s.card}>
            <Text style={s.label}>FINISH SETUP</Text>
            <Text style={s.text}>Complete your profile so your coach knows your goal.</Text>
            <Pressable style={[s.btn, { marginTop: 10, alignSelf: "flex-start" }]} onPress={() => router.push("/onboarding")}>
              <Text style={s.btnText}>Set up profile</Text>
            </Pressable>
          </View>
        )}

        <DeleteAccountButton />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  hey: { fontSize: 22, fontWeight: "700", color: T.ink, letterSpacing: 0.5 },
  signOut: { color: T.sub, fontSize: 13, textDecorationLine: "underline" },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  big: { fontSize: 26, fontWeight: "700", color: T.ink, letterSpacing: 0.5 },
  streak: { fontSize: 13, color: T.sub, marginTop: 4 },
  weekRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: T.line },
  dotOn: { backgroundColor: T.pine },
  btn: { backgroundColor: T.pine, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  btnGhostish: { backgroundColor: T.pineSoft },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  text: { fontSize: 13, color: T.sub, lineHeight: 19 },
  feedbackBody: { fontSize: 14, color: T.ink, lineHeight: 21 },
  aiTag: { fontSize: 11, color: T.teal, marginTop: 6 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.line,
    alignItems: "center", justifyContent: "center", backgroundColor: "#FBFBF9",
  },
  checkboxOn: { backgroundColor: T.pine, borderColor: T.pine },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  actionText: { flex: 1, fontSize: 14, color: T.ink },
  actionDone: { textDecorationLine: "line-through", color: T.sub },
});
