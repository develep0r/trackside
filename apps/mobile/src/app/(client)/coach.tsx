import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import {
  acceptInvite, getMyClientProfile, getMyPendingInvites, getTrainerPage,
  type Invite, type TrainerProfile,
} from "@/lib/api";
import { T } from "../../lib/theme";

type PendingInvite = Invite & { trainer: TrainerProfile | null };

export default function Coach() {
  const [coach, setCoach] = useState<TrainerProfile | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const profile = await getMyClientProfile();
      const [t, inv] = await Promise.all([
        profile?.trainer_id ? getTrainerPage(profile.trainer_id) : Promise.resolve(null),
        getMyPendingInvites(),
      ]);
      setCoach(t);
      // a pending invite from a *different* coach = a switch offer
      setInvites(inv.filter((i) => i.trainer_id !== profile?.trainer_id));
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onAccept = async (inv: PendingInvite) => {
    setBusy(true); setError("");
    const { error: err } = await acceptInvite(inv.id);
    setBusy(false);
    if (err) { setError(err.message); return; }
    await load();
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.title}>YOUR COACH</Text>

        {invites.map((inv) => (
          <View key={inv.id} style={[s.card, s.inviteCard]}>
            <Text style={s.inviteLabel}>NEW INVITE</Text>
            <Text style={s.inviteText}>
              Coach {inv.trainer?.name || "another coach"} invited you
              {coach ? " — accepting switches your coach and your data access moves with you." : "."}
            </Text>
            {!!error && <Text style={s.error}>{error}</Text>}
            <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => onAccept(inv)}>
              <Text style={s.btnText}>{busy ? "Connecting…" : `Join Coach ${inv.trainer?.name?.split(" ")[0] ?? ""}`}</Text>
            </Pressable>
          </View>
        ))}

        {coach ? (
          <View style={s.card}>
            <View style={s.avatar}><Text style={s.avatarLetter}>{coach.name.charAt(0)}</Text></View>
            <Text style={s.coachName}>{coach.name.toUpperCase()}</Text>
            {!!coach.headline && <Text style={s.headline}>{coach.headline}</Text>}
            <Text style={s.meta}>
              {[coach.years ? `${coach.years} yrs experience` : null, coach.location].filter(Boolean).join(" · ")}
            </Text>

            {!!coach.philosophy && (
              <>
                <Text style={s.sectionTitle}>PHILOSOPHY</Text>
                <Text style={s.body}>{coach.philosophy}</Text>
              </>
            )}
            {!!coach.credentials?.length && (
              <>
                <Text style={s.sectionTitle}>CREDENTIALS</Text>
                {coach.credentials.map((c) => <Text key={c} style={s.listItem}>· {c}</Text>)}
              </>
            )}
            {!!coach.specialties?.length && (
              <>
                <Text style={s.sectionTitle}>SPECIALTIES</Text>
                <View style={s.chipRow}>
                  {coach.specialties.map((sp) => (
                    <View key={sp} style={s.chip}><Text style={s.chipText}>{sp}</Text></View>
                  ))}
                </View>
              </>
            )}
          </View>
        ) : (
          loaded && invites.length === 0 && (
            <View style={s.card}>
              <Text style={s.body}>
                You're not connected to a coach yet. When a coach invites your number, their page and
                invite appear here.
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  title: { fontSize: 22, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 12 },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  inviteCard: { borderColor: T.pine, backgroundColor: T.pineSoft },
  inviteLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.pine, marginBottom: 6 },
  inviteText: { fontSize: 14, color: T.ink, lineHeight: 20 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: T.pineSoft,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  avatarLetter: { fontSize: 26, fontWeight: "700", color: T.pine },
  coachName: { fontSize: 20, fontWeight: "700", color: T.ink, letterSpacing: 0.5 },
  headline: { fontSize: 14, color: T.ink, marginTop: 2 },
  meta: { fontSize: 12, color: T.sub, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 16, marginBottom: 6 },
  body: { fontSize: 14, color: T.ink, lineHeight: 21 },
  listItem: { fontSize: 13, color: T.ink, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: T.pineSoft, borderWidth: 1, borderColor: T.pine,
  },
  chipText: { fontSize: 12, color: T.pine, fontWeight: "600" },
  error: { fontSize: 13, color: T.lane, marginTop: 8 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 12 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
