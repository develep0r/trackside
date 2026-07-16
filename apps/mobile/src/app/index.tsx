import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../lib/session";
import { T } from "../lib/theme";

export default function Gate() {
  const { loading, userId, role } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <ActivityIndicator color={T.pine} />
      </View>
    );
  }
  if (!userId) return <Redirect href="/sign-in" />;
  if (role === "trainer") return <Redirect href="/(trainer)/clients" />;
  return <Redirect href="/(client)/home" />;
}
