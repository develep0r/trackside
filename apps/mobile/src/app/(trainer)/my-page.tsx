import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { T } from "../../lib/theme";

// TODO: port the coach-page editor (avatar, gallery, credentials) from the prototype.
export default function MyPage() {
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.card}>
        <Text style={s.title}>MY COACH PAGE</Text>
        <Text style={s.text}>
          Your public page — photo, philosophy, credentials — is shown to every client you invite.
          Editor coming in the next build.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg, padding: 16 },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, padding: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: T.ink, letterSpacing: 0.5, marginBottom: 6 },
  text: { fontSize: 13, color: T.sub, lineHeight: 19 },
});
