import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule } from "@/components/mb";
import { parseAmount, deriveRate, toMajor } from "@/lib/money";
import { addPoolFromChange, getMeta } from "@/lib/db/mutations";
import { getTripCurrency } from "@/lib/db/queries";
import { referenceForeignPerHome, RATES_AS_OF } from "@/lib/fx/reference";
import { fonts } from "@/lib/theme";
import { capture } from "@/lib/analytics";

// Show a rate at a sensible precision across very different magnitudes
// (1 PHP = 438 VND, but 1 PHP = 0.017 USD).
function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(0);
  if (r >= 1) return r.toFixed(2);
  return r.toFixed(4);
}

export default function Changer() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const router = useRouter();
  const [gave, setGave] = useState(""); // home currency
  const [got, setGot] = useState(""); // foreign
  const [homeCur, setHomeCur] = useState("PHP");
  const [tripCur, setTripCur] = useState("VND");

  useEffect(() => {
    getMeta("home_currency", "PHP").then(setHomeCur);
    if (typeof trip === "string") getTripCurrency(trip).then(setTripCur);
  }, [trip]);

  const gaveMinor = parseAmount(gave || "0", homeCur);
  const gotMinor = parseAmount(got || "0", tripCur);
  const derived = deriveRate(gaveMinor, homeCur, gotMinor, tripCur); // tripCur per 1 homeCur

  // The default source: an approximate market rate, used whenever the user hasn't
  // given us both sides to derive their real rate from.
  const refRate = useMemo(() => referenceForeignPerHome(homeCur, tripCur), [homeCur, tripCur]);
  const usingReference = derived <= 0;
  const effRate = derived > 0 ? derived : (refRate ?? 0); // tripCur per 1 homeCur

  // Exactly one side filled → we can complete the other from the reference rate,
  // turning a partial entry into a savable change.
  const canFill = refRate != null && gaveMinor > 0 !== gotMinor > 0;
  const fillFromReference = () => {
    if (refRate == null) return;
    if (gaveMinor > 0 && gotMinor <= 0) {
      setGot(String(Math.round(toMajor(gaveMinor, homeCur) * refRate)));
    } else if (gotMinor > 0 && gaveMinor <= 0) {
      setGave((toMajor(gotMinor, tripCur) / refRate).toFixed(2));
    }
  };

  const save = async () => {
    if (gaveMinor <= 0 || gotMinor <= 0) return;
    await addPoolFromChange({
      tripId: typeof trip === "string" ? trip : null,
      gaveMinor,
      gaveCurrency: homeCur,
      gotMinor,
      gotCurrency: tripCur,
    });
    capture("money_changed", { rate: Math.round(derived) });
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

          <Eyebrow className="mt-5">You gave · {homeCur}</Eyebrow>
          <TextInput
            value={gave}
            onChangeText={setGave}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8A8578"
            style={{ fontFamily: fonts.mono }}
            className="text-ink text-3xl py-2"
          />
          <Eyebrow className="mt-4">You got · {tripCur}</Eyebrow>
          <TextInput
            value={got}
            onChangeText={setGot}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8A8578"
            style={{ fontFamily: fonts.mono }}
            className="text-ink text-3xl py-2"
          />

          {effRate > 0 ? (
            <View className="mt-4">
              <Text className="text-teal text-lg" style={{ fontFamily: fonts.mono }}>
                {usingReference ? "Reference" : "Your rate"} · 1 {homeCur} = {fmtRate(effRate)} {tripCur}
              </Text>
              {usingReference ? (
                <Text className="text-carbon text-xs mt-1">
                  Market estimate ({RATES_AS_OF}). Enter what you gave and got for your exact rate.
                </Text>
              ) : null}
            </View>
          ) : null}

          {canFill ? (
            <Pressable onPress={fillFromReference} className="mt-3 border border-hair rounded-md py-2.5 items-center">
              <Text className="text-carbon">Fill the other amount at the reference rate</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={save}
            disabled={derived <= 0}
            className={`rounded-md py-3.5 items-center mt-6 ${derived > 0 ? "bg-ink" : "bg-hair"}`}
          >
            <Text className="text-paper-lit font-bold">Save to pool</Text>
          </Pressable>
          <Text className="text-carbon text-xs mt-3">
            Micro Budget derives your real rate from what you gave and got — it never asks. No money-change yet? This
            trip falls back to the reference rate above until you make one.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
