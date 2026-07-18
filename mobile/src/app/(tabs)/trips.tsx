import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getTrips, getTripExpenses, type Trip, type ExpenseRow } from "@/lib/db/queries";
import { Screen, Eyebrow, Ritual, Rule, DottedRule, Money, Stamp } from "@/components/mb";

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Record<string, ExpenseRow[]>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTrips().then(async (ts) => {
        if (!alive) return;
        setTrips(ts);
        const map: Record<string, ExpenseRow[]> = {};
        for (const t of ts) map[t.id] = await getTripExpenses(t.id);
        if (alive) setExpenses(map);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-2 pb-16">
          <Ritual className="text-3xl">Trips</Ritual>
          <Eyebrow className="mt-1">Travel mode · multi-currency</Eyebrow>
          <Rule className="mt-3" />

          {trips.length === 0 ? <Text className="text-carbon mt-4">No trips yet.</Text> : null}

          {trips.map((t) => (
            <View key={t.id} className="mt-5">
              <View className="flex-row items-center justify-between">
                <Ritual className="text-xl">{t.name}</Ritual>
                <Stamp tone="teal">{t.status}</Stamp>
              </View>
              <DottedRule className="mt-2" />
              {(expenses[t.id] ?? []).map((e) => (
                <View key={e.id} className="flex-row items-center py-2 border-t border-hair">
                  <Text className="text-ink flex-1">{e.note ?? "Expense"}</Text>
                  <Money minor={e.amount} currency={e.currency} className="text-sm" />
                </View>
              ))}
            </View>
          ))}

          <Text className="text-carbon text-xs mt-8">
            The signature Nightly Review — geo-trail + amber gap recovery — attaches to a trip. Wired next.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
