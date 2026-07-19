import { useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule } from "@/components/mb";
import { addTrip } from "@/lib/db/mutations";
import { capture } from "@/lib/analytics";

export default function NewTrip() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("VND");

  const save = async () => {
    if (!name.trim()) return;
    await addTrip({ name: name.trim(), homeCurrency: currency.trim().toUpperCase() || "VND" });
    capture("trip_created");
    router.back();
  };

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-3">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">New trip</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Cancel</Text>
            </Pressable>
          </View>
          <Rule className="mt-3" />

          <Eyebrow className="mt-5 mb-1">Where to?</Eyebrow>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Hanoi, Sapa, Tokyo…"
            placeholderTextColor="#8A8578"
            autoFocus
            className="border border-hair rounded-md px-3 py-3 text-ink text-lg"
          />

          <Eyebrow className="mt-5 mb-1">Spending currency</Eyebrow>
          <TextInput
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            placeholder="VND"
            placeholderTextColor="#8A8578"
            className="border border-hair rounded-md px-3 py-3 text-ink"
          />

          <Pressable
            onPress={save}
            disabled={!name.trim()}
            className={`rounded-md py-3.5 items-center mt-8 ${name.trim() ? "bg-ink" : "bg-hair"}`}
          >
            <Text className="text-paper-lit font-bold">Start trip</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
