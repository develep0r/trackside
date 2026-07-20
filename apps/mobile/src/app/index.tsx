import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { getMyClientProfile } from "@/lib/api";
import { useSession } from "../lib/session";
import { T } from "../lib/theme";

export default function Gate() {
  const { loading, userId, role } = useSession();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Clients without a profile go to onboarding first.
  useEffect(() => {
    if (loading || !userId || role !== "client") return;
    let live = true;
    getMyClientProfile().then((p) => { if (live) setHasProfile(!!p); });
    return () => { live = false; };
  }, [loading, userId, role]);

  // role === null with a live session means the role fetch is still in flight —
  // redirecting then would dump trainers into client onboarding.
  const busy =
    loading ||
    (userId && role === null) ||
    (userId && role === "client" && hasProfile === null);
  if (busy) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <ActivityIndicator color={T.pine} />
      </View>
    );
  }
  if (!userId) return <Redirect href="/sign-in" />;
  if (role === "trainer") return <Redirect href="/(trainer)/clients" />;
  if (!hasProfile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(client)/home" />;
}
