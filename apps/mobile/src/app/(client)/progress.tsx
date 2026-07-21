import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { getCheckins, getMyClientProfile, type Checkin, type ClientProfile } from "@/lib/api";
import { T } from "../../lib/theme";

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function Progress() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [c, p] = await Promise.all([getCheckins(), getMyClientProfile()]);
      setCheckins(c); setProfile(p);
    })();
  }, []));

  const weights = useMemo(() => checkins.filter((c) => c.weight != null).slice(-30), [checkins]);
  const trend = useMemo(() => {
    if (weights.length < 2) return null;
    const ws = weights.map((c) => c.weight as number);
    const min = Math.min(...ws), max = Math.max(...ws);
    return { min, max, span: Math.max(max - min, 0.5) };
  }, [weights]);

  const latest = weights[weights.length - 1]?.weight ?? null;
  const first = weights[0]?.weight ?? null;
  const delta = latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null;
  const target = profile?.target_weight ?? null;

  const stats = [
    { label: "NOW", value: latest != null ? `${latest} kg` : "—" },
    { label: "CHANGE", value: delta != null ? `${delta > 0 ? "+" : ""}${delta} kg` : "—", accent: delta != null && delta < 0 },
    { label: "TARGET", value: target != null ? `${target} kg` : "—" },
  ];

  const recent = useMemo(() => [...checkins].reverse().slice(0, 21), [checkins]);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.title}>YOUR PROGRESS</Text>

        <View style={s.statsRow}>
          {stats.map((st) => (
            <View key={st.label} style={s.stat}>
              <Text style={[s.statValue, st.accent && { color: T.teal }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>WEIGHT — LAST {weights.length} LOGS</Text>
          {trend ? (
            <>
              <View style={s.chartRow}>
                {weights.map((c) => {
                  const h = 10 + ((c.weight! - trend.min) / trend.span) * 90;
                  return <View key={c.id} style={[s.bar, { height: h }]} />;
                })}
              </View>
              <View style={s.chartLabels}>
                <Text style={s.chartLabel}>{fmtDay(weights[0].date)}</Text>
                <Text style={s.chartLabel}>{trend.min}–{trend.max} kg</Text>
                <Text style={s.chartLabel}>{fmtDay(weights[weights.length - 1].date)}</Text>
              </View>
            </>
          ) : (
            <Text style={s.empty}>Log a few weigh-ins and your trend appears here.</Text>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>PHOTO TIMELINE</Text>
          <Text style={s.empty}>📷 Progress photos coming soon.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>HISTORY</Text>
          {recent.length === 0 && <Text style={s.empty}>No check-ins yet.</Text>}
          {recent.map((c) => (
            <View key={c.id} style={s.historyRow}>
              <Text style={s.historyDate}>{fmtDay(c.date)}</Text>
              <Text style={s.historyMeta}>
                {c.weight != null ? `${c.weight} kg` : "—"}
                {c.energy != null ? ` · E${c.energy}` : ""}
                {c.sleep_hrs != null ? ` · ${c.sleep_hrs}h` : ""}
                {` · ${c.workout ? "trained" : "rest"}`}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  title: { fontSize: 22, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 12, alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: T.pine },
  statLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 0.8, color: T.sub, marginTop: 2 },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 10 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 110 },
  bar: { flex: 1, maxWidth: 12, borderRadius: 3, backgroundColor: T.pineSoft, borderWidth: 1, borderColor: T.pine },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  chartLabel: { fontSize: 10, color: T.sub },
  empty: { fontSize: 13, color: T.sub },
  historyRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  historyDate: { fontSize: 13, fontWeight: "600", color: T.ink },
  historyMeta: { fontSize: 13, color: T.sub },
});
