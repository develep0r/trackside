import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getMyClientProfile, signOut, type ClientProfile } from "@trackside/api";
import { T } from "../../lib/theme";

export default function Home() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMyClientProfile().then((p) => { setProfile(p); setLoaded(true); });
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.hey}>
          HEY {loaded ? (profile?.name?.split(" ")[0] ?? "THERE").toUpperCase() : "…"}
        </Text>
        <Pressable onPress={async () => { await signOut(); router.replace("/sign-in"); }}>
          <Text style={s.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.label}>{today.toUpperCase()}</Text>
        <View style={s.row}>
          <Text style={s.big}>LOG TODAY</Text>
          <Pressable style={s.btn} onPress={() => router.push("/(client)/check-in")}>
            <Text style={s.btnText}>Check in</Text>
          </Pressable>
        </View>
      </View>

      {loaded && !profile && (
        <View style={s.card}>
          <Text style={s.label}>FINISH SETUP</Text>
          <Text style={s.text}>
            Complete your profile so your coach knows your goal. Onboarding flow coming in the
            next build.
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.label}>FROM YOUR COACH</Text>
        <Text style={s.text}>No feedback yet. Keep logging — your coach reviews your check-ins here.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg, padding: 16 },
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
  btn: { backgroundColor: T.pine, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  text: { fontSize: 13, color: T.sub, lineHeight: 19 },
});
