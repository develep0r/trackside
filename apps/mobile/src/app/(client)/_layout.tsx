import { Tabs } from "expo-router";
import { T } from "../../lib/theme";

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.pine,
        tabBarInactiveTintColor: T.sub,
        tabBarStyle: { backgroundColor: T.card, borderTopColor: T.line },
        sceneStyle: { backgroundColor: T.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="check-in" options={{ title: "Check-in" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
    </Tabs>
  );
}
