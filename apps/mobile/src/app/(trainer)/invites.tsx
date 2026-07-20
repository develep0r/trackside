import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createInvite, getSentInvites, revokeInvite, type Invite } from "@/lib/api";
import { T } from "../../lib/theme";

export default function Invites() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [sent, setSent] = useState<Invite[]>([]);

  const load = useCallback(async () => setSent(await getSentInvites()), []);
  useEffect(() => { load(); }, [load]);

  const onSend = async () => {
    setBusy(true); setMsg(null);
    try {
      const { error } = await createInvite(phone, name.trim() || undefined);
      if (error) throw new Error(error.message);
      setMsg({ text: "Invite sent ✓", ok: true });
      setName(""); setPhone("");
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't send invite", ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <FlatList
        data={sent}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={s.card}>
            <Text style={s.title}>ADD A CLIENT</Text>
            <Text style={s.hint}>
              They'll get an SMS invite. When they sign in with this number, they're linked to you
              automatically.
            </Text>
            <Text style={s.label}>CLIENT NAME</Text>
            <TextInput
              style={s.input} placeholder="e.g. Rohit Kumar" placeholderTextColor={T.sub}
              value={name} onChangeText={setName}
            />
            <Text style={s.label}>MOBILE NUMBER</Text>
            <TextInput
              style={s.input} placeholder="98765 43210" placeholderTextColor={T.sub}
              keyboardType="number-pad" maxLength={10}
              value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
            />
            {msg && <Text style={[s.msg, { color: msg.ok ? T.pine : T.lane }]}>{msg.text}</Text>}
            <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={onSend}>
              <Text style={s.btnText}>{busy ? "Sending…" : "Send invite"}</Text>
            </Pressable>
            {sent.length > 0 && <Text style={s.sectionTitle}>SENT INVITES</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.inviteRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.client_name || "Unnamed"}</Text>
              <Text style={s.meta}>+{item.phone}</Text>
            </View>
            <Text style={[s.status, item.status === "pending" ? s.pending : s.done]}>
              {item.status}
            </Text>
            {item.status === "pending" && (
              <Pressable onPress={async () => { await revokeInvite(item.id); await load(); }}>
                <Text style={s.revoke}>Revoke</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 4 },
  hint: { fontSize: 13, color: T.sub, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 4 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 16, backgroundColor: "#FBFBF9", color: T.ink, marginBottom: 12,
  },
  msg: { fontSize: 13, marginBottom: 10 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginTop: 20 },
  inviteRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.card,
    borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 14, marginBottom: 8,
  },
  name: { fontSize: 14, fontWeight: "600", color: T.ink },
  meta: { fontSize: 12, color: T.sub, marginTop: 2 },
  status: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  pending: { color: T.teal },
  done: { color: T.sub },
  revoke: { fontSize: 12, color: T.lane, textDecorationLine: "underline" },
});
