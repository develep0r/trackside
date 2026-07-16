import { Tabs } from "expo-router";
import { T } from "../../lib/theme";

export default function TrainerLayout() {
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
      <Tabs.Screen name="clients" options={{ title: "Clients" }} />
      <Tabs.Screen name="invites" options={{ title: "Invites" }} />
      <Tabs.Screen name="my-page" options={{ title: "My page" }} />
    </Tabs>
  );
}
