import "../global.css";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PostHogProvider } from "posthog-react-native";
import { posthog } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/db/seed";
import { scheduleNightlyReview } from "@/lib/notifications";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await getDb();
      await seedIfEmpty();
      if (alive) setReady(true);
      // Best-effort: schedule the evening "close your day" notification.
      void scheduleNightlyReview();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const content = (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {ready ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expense/new" options={{ presentation: "modal" }} />
        </Stack>
      ) : (
        <View className="flex-1 bg-paper" />
      )}
    </SafeAreaProvider>
  );

  // PostHog is optional — render plainly when unconfigured.
  return posthog ? (
    <PostHogProvider client={posthog} autocapture>
      {content}
    </PostHogProvider>
  ) : (
    content
  );
}
