import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { deleteMyAccount, errorMessage, signOut } from "@/lib/api";
import { T } from "./theme";

/**
 * Two-tap in-app account deletion (App Store requirement for any app with
 * accounts). First tap arms the button; second tap runs the server-side
 * purge (storage + auth user, cascading to all rows) and signs out.
 * Two-tap instead of Alert.alert because RN alerts are no-ops on web.
 */
export function DeleteAccountButton() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onPress = async () => {
    if (!armed) { setArmed(true); return; }
    setBusy(true); setError("");
    try {
      const { error: err } = await deleteMyAccount();
      if (err) throw err;
      await signOut().catch?.(() => {});
      router.replace("/sign-in");
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete your account — try again or contact support."));
      setArmed(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.zone}>
      {armed && (
        <Text style={s.warning}>
          This permanently erases your account, check-ins, photos, and feedback. There is no undo.
        </Text>
      )}
      {!!error && <Text style={s.error}>{error}</Text>}
      <Pressable disabled={busy} onPress={onPress}>
        <Text style={s.link}>
          {busy ? "Deleting…" : armed ? "Tap again to permanently delete" : "Delete account"}
        </Text>
      </Pressable>
      {armed && !busy && (
        <Pressable onPress={() => { setArmed(false); setError(""); }}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  zone: { alignItems: "center", marginTop: 24, gap: 8 },
  warning: { fontSize: 12, color: T.lane, textAlign: "center", lineHeight: 17, paddingHorizontal: 24 },
  error: { fontSize: 12, color: T.lane, textAlign: "center" },
  link: { fontSize: 13, color: T.lane, textDecorationLine: "underline" },
  cancel: { fontSize: 13, color: T.sub, textDecorationLine: "underline" },
});
