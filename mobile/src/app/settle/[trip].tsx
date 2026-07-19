import { useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable, Share } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule, Money } from "@/components/mb";
import { getSettlement, type Settlement } from "@/lib/db/queries";
import { format } from "@/lib/money";
import { capture } from "@/lib/analytics";

export default function Settle() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const router = useRouter();
  const [s, setS] = useState<Settlement | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (trip) getSettlement(trip).then(setS);
    }, [trip]),
  );

  if (!s) {
    return (
      <Screen>
        <View className="flex-1 bg-paper" />
      </Screen>
    );
  }

  const exportSummary = async () => {
    const lines = s.transfers.length
      ? s.transfers.map(
          (t) =>
            `${t.fromName} owes ${t.toName} ${format(t.amount, s.homeCurrency)}`,
        )
      : ["All settled — nobody owes anyone."];
    capture("settlement_exported");
    await Share.share({
      message: `Micro Budget — settle up\n\n${lines.join("\n")}\n\nSettle on GCash, outside the app.`,
    });
  };

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-2 pb-16">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">Settle up</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Done</Text>
            </Pressable>
          </View>
          <Eyebrow className="mt-1">
            Ghost split · settle outside the app
          </Eyebrow>
          <Rule className="mt-3" />

          <Eyebrow className="mt-4 mb-1">Fronted</Eyebrow>
          {s.fronted.map((f) => (
            <View
              key={f.id}
              className="flex-row justify-between py-2 border-t border-hair"
            >
              <Text className="text-ink font-semibold">{f.name}</Text>
              <Money
                minor={f.minor}
                currency={s.homeCurrency}
                className="text-sm"
              />
            </View>
          ))}

          <View className="mt-5 border-t-2 border-b-2 border-amber-ink py-3">
            {s.transfers.length === 0 ? (
              <Text className="text-teal font-bold">
                All settled — nobody owes anyone.
              </Text>
            ) : (
              s.transfers.map((t, i) => (
                <View key={i}>
                  <Eyebrow className="text-amber-ink">
                    {t.fromName} owes {t.toName}
                  </Eyebrow>
                  <Money
                    minor={t.amount}
                    currency={s.homeCurrency}
                    className="text-amber-ink text-2xl mt-1"
                  />
                </View>
              ))
            )}
          </View>

          {s.unrated > 0 ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/changer/[trip]", params: { trip } })
              }
              className="mt-4 border border-amber-ink rounded-md p-3"
            >
              <Eyebrow className="text-amber-ink">
                {s.unrated} shared {s.unrated === 1 ? "expense" : "expenses"}{" "}
                can't be settled yet
              </Eyebrow>
              <Text className="text-carbon text-xs mt-1">
                They're in a foreign currency with no rate. Log a money-change
                and they'll settle automatically. Tap to open Money changer.
              </Text>
            </Pressable>
          ) : null}

          {s.estimated > 0 ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/changer/[trip]", params: { trip } })
              }
            >
              <Text className="text-carbon text-xs mt-3">
                {s.estimated} {s.estimated === 1 ? "amount uses" : "amounts use"}{" "}
                an approximate reference rate. Record a money-change for this trip
                to settle at your exact rate.
              </Text>
            </Pressable>
          ) : null}

          <Eyebrow className="mt-5 mb-1">Shared items</Eyebrow>
          {s.items.map((it, i) => (
            <View
              key={i}
              className="flex-row justify-between py-2 border-t border-hair"
            >
              <Text className="text-ink flex-1" numberOfLines={1}>
                {it.note ?? "Expense"} · {it.payerName}
              </Text>
              <Money
                minor={it.homeMinor}
                currency={s.homeCurrency}
                className="text-sm"
              />
            </View>
          ))}

          <Pressable
            onPress={exportSummary}
            className="bg-ink rounded-md py-3.5 items-center mt-6"
          >
            <Text className="text-paper-lit font-bold">Share summary</Text>
          </Pressable>
          <Text className="text-carbon text-xs mt-3">
            Companions don't need the app. Send them the summary and settle for
            real.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
