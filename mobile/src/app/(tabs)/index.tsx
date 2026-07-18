import { useCallback, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getTodaySummary, type TodaySummary } from "@/lib/db/queries";
import { format } from "@/lib/money";
import { Screen, Eyebrow, Ritual, Money, Mono, Rule, DottedRule, Stamp, Bar } from "@/components/mb";

export default function Today() {
  const router = useRouter();
  const [s, setS] = useState<TodaySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTodaySummary().then((r) => {
        if (alive) setS(r);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (!s) {
    return (
      <Screen>
        <View className="flex-1 bg-paper" />
      </Screen>
    );
  }

  const pctSpent = s.budgetMinor > 0 ? (s.spentMinor / s.budgetMinor) * 100 : 0;
  const dateLabel = new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pb-28">
          <View className="pt-2">
            <Ritual className="text-3xl">Today</Ritual>
            <Eyebrow className="mt-1">{dateLabel} · Daily</Eyebrow>
            <Rule className="mt-3" />
          </View>

          <View className="flex-row justify-between items-end mt-4">
            <View>
              <Eyebrow>Safe to spend today</Eyebrow>
              <Money minor={s.safeTodayMinor} currency={s.homeCurrency} className="text-teal text-2xl mt-1" />
            </View>
            <View className="items-end">
              <Eyebrow>
                {s.monthLabel} · {format(s.budgetMinor, s.homeCurrency)}
              </Eyebrow>
              <Mono className="text-carbon text-xs mt-1">
                spent {format(s.spentMinor, s.homeCurrency)} · {Math.round(pctSpent)}%
              </Mono>
            </View>
          </View>

          <View className="mt-3">
            <Bar pct={pctSpent} state={s.spentMinor > s.budgetMinor ? "over" : pctSpent >= 85 ? "warn" : "ok"} />
          </View>

          <DottedRule className="mt-5" />
          <Eyebrow className="mt-4 mb-1">Category · spent / limit</Eyebrow>
          {s.categories.map((c) => {
            const pct = c.limit > 0 ? (c.spent / c.limit) * 100 : 0;
            return (
              <View key={c.id} className="flex-row items-center py-2 border-t border-hair">
                <Text className="text-ink font-semibold w-24">{c.name}</Text>
                <View className="flex-1 mr-3">
                  <Bar pct={pct} state={c.state} />
                </View>
                <View className="flex-row items-center">
                  {c.state !== "ok" ? (
                    <View className="mr-1">
                      <Stamp tone={c.state === "over" ? "red" : "amber"}>!</Stamp>
                    </View>
                  ) : null}
                  <Money minor={c.spent} currency={s.homeCurrency} className="text-xs" />
                  <Mono className="text-carbon text-xs">/{format(c.limit, s.homeCurrency, { code: false })}</Mono>
                </View>
              </View>
            );
          })}

          <DottedRule className="mt-5" />
          <Eyebrow className="mt-4 mb-1">Today</Eyebrow>
          {s.today.length === 0 ? (
            <Text className="text-carbon py-3">Nothing logged yet. Tap Log expense below.</Text>
          ) : null}
          {s.today.map((e) => (
            <View key={e.id} className="flex-row items-center py-2 border-t border-hair">
              <Mono className="text-carbon text-xs w-14">
                {new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </Mono>
              <Text className="text-ink font-semibold flex-1">{e.note ?? e.categoryName ?? "Expense"}</Text>
              <Money minor={e.amount} currency={e.currency} className="text-sm" />
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3 bg-paper">
        <Pressable
          onPress={() => router.push("/expense/new")}
          className="bg-ink rounded-md py-3.5 items-center active:opacity-80"
        >
          <Text className="text-paper-lit font-bold">+  Log expense</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
