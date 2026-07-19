import { useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule } from "@/components/mb";
import { parseAmount, deriveRate } from "@/lib/money";
import { addPoolFromChange } from "@/lib/db/mutations";
import { fonts } from "@/lib/theme";
import { capture } from "@/lib/analytics";

export default function Changer() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const router = useRouter();
  const [gave, setGave] = useState(""); // home currency
  const [got, setGot] = useState(""); // foreign

  const gaveMinor = parseAmount(gave || "0", "PHP");
  const gotMinor = parseAmount(got || "0", "VND");
  const rate = deriveRate(gaveMinor, "PHP", gotMinor, "VND"); // VND per 1 PHP

  const save = async () => {
    if (gaveMinor <= 0 || gotMinor <= 0) return;
    await addPoolFromChange({
      tripId: typeof trip === "string" ? trip : null,
      gaveMinor,
      gaveCurrency: "PHP",
      gotMinor,
      gotCurrency: "VND",
    });
    capture("money_changed", { rate: Math.round(rate) });
    router.back();
  };

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-3">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">Money changer</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Cancel</Text>
            </Pressable>
          </View>
          <Rule className="mt-3" />

          <Eyebrow className="mt-5">You gave · PHP</Eyebrow>
          <TextInput
            value={gave}
            onChangeText={setGave}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8A8578"
            style={{ fontFamily: fonts.mono }}
            className="text-ink text-3xl py-2"
          />
          <Eyebrow className="mt-4">You got · VND</Eyebrow>
          <TextInput
            value={got}
            onChangeText={setGot}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8A8578"
            style={{ fontFamily: fonts.mono }}
            className="text-ink text-3xl py-2"
          />

          {rate > 0 ? (
            <Text className="text-teal text-lg mt-4" style={{ fontFamily: fonts.mono }}>
              Derived rate: 1 PHP = {rate.toFixed(0)} VND
            </Text>
          ) : null}

          <Pressable
            onPress={save}
            disabled={rate <= 0}
            className={`rounded-md py-3.5 items-center mt-8 ${rate > 0 ? "bg-ink" : "bg-hair"}`}
          >
            <Text className="text-paper-lit font-bold">Save to pool</Text>
          </Pressable>
          <Text className="text-carbon text-xs mt-3">
            Micro Budget derives your real rate from what you gave and got — it never asks.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
