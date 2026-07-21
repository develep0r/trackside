import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getRoster, signOut, type RosterRow } from "@/lib/api";
import { T } from "../../lib/theme";

export default function Clients() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setRows(await getRoster());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load roster");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loggedToday = rows.filter((r) => r.days_since_log === 0).length;
  const needAttention = rows.filter((r) => (r.days_since_log ?? 99) >= 3).length;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>TRACKSIDE · COACH</Text>
          <Text style={s.sub}>{rows.length} clients</Text>
        </View>
        <Pressable onPress={async () => { await signOut(); router.replace("/sign-in"); }}>
          <Text style={s.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={s.statsRow}>
        <Stat n={rows.length} label="CLIENTS" />
        <Stat n={loggedToday} label="LOGGED TODAY" />
        <Stat n={needAttention} label="NEED ATTENTION" accent={needAttention > 0} />
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.client_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={T.pine} />}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={
          !refreshing ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No clients yet</Text>
              <Text style={s.emptyText}>Invite your first client from the Invites tab.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const stale = (item.days_since_log ?? 99) >= 3;
          return (
            <Pressable
              style={s.card}
              onPress={() =>
                router.push({
                  pathname: "/(trainer)/client/[id]",
                  params: {
                    id: item.client_id,
                    name: item.name,
                    goal: item.goal ?? "",
                    days: item.days_since_log != null ? String(item.days_since_log) : "",
                  },
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>
                  {item.last_log_date
                    ? `Last log ${item.last_log_date} · ${item.logs_7d ?? 0}/7 this week`
                    : "No check-ins yet"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.weight}>{item.weight_now != null ? `${item.weight_now} kg` : "—"}</Text>
                {stale && <Text style={s.flag}>{item.days_since_log}d silent</Text>}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statN, accent && { color: T.lane }]}>{n}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5 },
  sub: { fontSize: 12, color: T.sub, marginTop: 2 },
  signOut: { color: T.sub, fontSize: 13, textDecorationLine: "underline" },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  stat: {
    flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 12, alignItems: "center",
  },
  statN: { fontSize: 22, fontWeight: "700", color: T.pine },
  statLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 0.8, color: T.sub, marginTop: 2 },
  error: { color: T.lane, fontSize: 13, paddingHorizontal: 16, marginBottom: 4 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.card,
    borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: "600", color: T.ink },
  meta: { fontSize: 12, color: T.sub, marginTop: 2 },
  weight: { fontSize: 15, fontWeight: "700", color: T.ink },
  flag: {
    fontSize: 11, fontWeight: "600", color: T.lane, backgroundColor: T.laneSoft,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", marginTop: 4,
  },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: T.ink },
  emptyText: { fontSize: 13, color: T.sub, marginTop: 4 },
});
