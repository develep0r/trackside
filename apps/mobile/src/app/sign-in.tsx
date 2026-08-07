import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MOCK_MODE, MOCK_OTP, normalizePhone, sendOtp, verifyOtp } from "@/lib/api";
import { T } from "../lib/theme";

// Canonical form is digits-only (matches invites/profiles); auth wants +E.164.
const toE164 = (raw: string): string | null => {
  const n = normalizePhone(raw);
  return n ? `+${n}` : null;
};

export default function SignIn() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const e164 = () => toE164(phone);

  const onSendOtp = async () => {
    const p = e164();
    if (!p) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    setError(""); setBusy(true);
    const { error: err } = await sendOtp(p);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setCode(""); setStep("otp");
  };

  const onVerify = async () => {
    const p = e164();
    if (!p || code.trim().length < 6) { setError("Enter the 6-digit code."); return; }
    setError(""); setBusy(true);
    const { error: err } = await verifyOtp(p, code.trim());
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.replace("/"); // gate routes by role
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.body}>
        <View style={s.header}>
          <Text style={s.logo}>TRACKSIDE</Text>
          <Text style={s.tagline}>Daily progress, coached weekly.</Text>
        </View>

        <View style={s.card}>
          {step === "phone" ? (
            <>
              <Text style={s.title}>SIGN IN</Text>
              <Text style={s.hint}>We'll text a one-time code to verify it's you.</Text>
              <Text style={s.label}>MOBILE NUMBER</Text>
              <View style={s.row}>
                <View style={s.prefix}><Text style={s.prefixText}>+91</Text></View>
                <TextInput
                  testID="phone-input"
                  style={s.input}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="98765 43210"
                  placeholderTextColor={T.sub}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
                  autoFocus
                />
              </View>
              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={onSendOtp}>
                <Text style={s.btnText}>{busy ? "Sending…" : "Send OTP"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.title}>ENTER THE CODE</Text>
              <Text style={s.hint}>
                Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}{"  "}
                <Text style={s.link} onPress={() => { setStep("phone"); setError(""); }}>change</Text>
              </Text>
              {MOCK_MODE && (
                <View style={s.demoBox}>
                  <Text style={s.demoText}>
                    DEMO MODE — no SMS is sent. Your code is <Text style={s.demoCode}>{MOCK_OTP}</Text>.
                    Coach sign-in: 90000 12345 · any other number joins as a client.
                  </Text>
                </View>
              )}
              <TextInput
                testID="otp-input"
                style={s.otpInput}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={T.sub}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                autoFocus
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={onVerify}>
                <Text style={s.btnText}>{busy ? "Verifying…" : "Verify & continue"}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={onSendOtp}>
                <Text style={s.resend}>Resend code</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  body: { flex: 1, justifyContent: "center", padding: 20 },
  header: { alignItems: "center", marginBottom: 28 },
  logo: { fontSize: 40, fontWeight: "700", color: T.pine, letterSpacing: 1.5 },
  tagline: { fontSize: 14, color: T.sub, marginTop: 6 },
  card: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: 14, padding: 16,
  },
  title: { fontSize: 20, fontWeight: "600", color: T.ink, letterSpacing: 0.5, marginBottom: 4 },
  hint: { fontSize: 13, color: T.sub, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: T.sub, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  prefix: {
    width: 64, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    alignItems: "center", justifyContent: "center", backgroundColor: "#FBFBF9",
  },
  prefixText: { color: T.sub, fontSize: 16 },
  input: {
    flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 16, backgroundColor: "#FBFBF9", color: T.ink,
  },
  otpInput: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.line,
    fontSize: 24, letterSpacing: 12, textAlign: "center",
    backgroundColor: "#FBFBF9", color: T.ink, marginBottom: 12,
  },
  error: { fontSize: 13, color: T.lane, marginBottom: 10 },
  btn: { backgroundColor: T.pine, borderRadius: 12, padding: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  link: { color: T.pine, textDecorationLine: "underline" },
  demoBox: {
    backgroundColor: T.pineSoft, borderWidth: 1, borderColor: T.pine, borderStyle: "dashed",
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  demoText: { fontSize: 12, color: T.pine, lineHeight: 17 },
  demoCode: { fontWeight: "700", letterSpacing: 2 },
  resend: { textAlign: "center", color: T.pine, fontSize: 13, marginTop: 12 },
});
