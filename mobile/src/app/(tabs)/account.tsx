import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { Screen, Eyebrow, Ritual, Rule, DottedRule, Stamp } from "@/components/mb";
import { useSession, signInWithEmail, signOut } from "@/lib/auth";
import { flushOutbox } from "@/lib/sync";
import { pendingSyncCount } from "@/lib/db/queries";
import { scheduleNightlyReview } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Account() {
  const { session } = useSession();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      pendingSyncCount().then((n) => alive && setPending(n));
      return () => {
        alive = false;
      };
    }, []),
  );

  const sendLink = async () => {
    setBusy(true);
    const { error } = await signInWithEmail(email);
    setBusy(false);
    Alert.alert(
      error ? "Couldn't send link" : "Check your email",
      error ? error.message : "Tap the magic link to sign in and back up your data.",
    );
  };

  const syncNow = async () => {
    setBusy(true);
    const r = await flushOutbox();
    setBusy(false);
    pendingSyncCount().then(setPending);
    Alert.alert("Sync", r.error ?? `Backed up ${r.pushed} change${r.pushed === 1 ? "" : "s"}.`);
  };

  return (
    <Screen>
      <View className="px-5 pt-2 flex-1">
        <Ritual className="text-3xl">Account</Ritual>
        <Eyebrow className="mt-1">Optional · your data lives on this device</Eyebrow>
        <Rule className="mt-3" />

        <Eyebrow className="mt-5 mb-2">Backup & sync</Eyebrow>
        {session ? (
          <View>
            <Text className="text-ink">Signed in as {session.user.email ?? "you"}</Text>
            <View className="flex-row mt-2">
              <Stamp tone={pending > 0 ? "amber" : "teal"}>
                {pending > 0 ? `${pending} to sync` : "all backed up"}
              </Stamp>
            </View>
            <Pressable onPress={syncNow} disabled={busy} className="bg-ink rounded-md py-3 items-center mt-3">
              <Text className="text-paper-lit font-bold">Sync now</Text>
            </Pressable>
            <Pressable onPress={() => signOut()} className="py-3 items-center mt-1">
              <Text className="text-carbon">Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text className="text-carbon mb-2">
              You're using Micro Budget offline. Sign in to back up and sync — nothing here is required.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#8A8578"
              className="border border-hair rounded-md px-3 py-3 text-ink"
            />
            <Pressable
              onPress={sendLink}
              disabled={busy || !email || !isSupabaseConfigured}
              className="bg-ink rounded-md py-3 items-center mt-2"
            >
              <Text className="text-paper-lit font-bold">Email me a magic link</Text>
            </Pressable>
            {pending > 0 ? (
              <Text className="text-carbon text-xs mt-2">
                {pending} local change{pending === 1 ? "" : "s"} waiting to sync.
              </Text>
            ) : null}
          </View>
        )}

        <DottedRule className="mt-6" />
        <Eyebrow className="mt-4 mb-1">Preferences</Eyebrow>
        <Pressable
          onPress={() => toggleColorScheme()}
          className="flex-row justify-between items-center py-3 border-t border-hair"
        >
          <Text className="text-ink">Theme</Text>
          <Stamp>{colorScheme === "dark" ? "Dark" : "Light"}</Stamp>
        </Pressable>
        <Pressable
          onPress={() =>
            scheduleNightlyReview().then((ok) =>
              Alert.alert(
                ok ? "Reminder set" : "Notifications off",
                ok ? "You'll get a nudge at 8:00 PM to close your day." : "Enable notifications in Settings to get the nightly nudge.",
              ),
            )
          }
          className="flex-row justify-between items-center py-3 border-t border-hair"
        >
          <Text className="text-ink">Nightly review reminder</Text>
          <Stamp tone="teal">8:00 PM</Stamp>
        </Pressable>
      </View>
    </Screen>
  );
}
