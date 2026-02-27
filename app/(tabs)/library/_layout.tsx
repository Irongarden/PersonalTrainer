import { Stack } from "expo-router";
import { useTheme } from "@/hooks/useTheme";

export default function LibraryLayout() {
  const colors = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Exercise Detail" }} />
      <Stack.Screen name="new" options={{ title: "New Exercise", presentation: "modal" }} />
    </Stack>
  );
}
