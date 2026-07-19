import { useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule, Mono, Money, Stamp } from "@/components/mb";
import { getTripReview, type ReviewStay } from "@/lib/db/queries";
import { updateStayReview } from "@/lib/db/mutations";
import { capture } from "@/lib/analytics";

export default function Review() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const router = useRouter();
  const [stays, setStays] = useState<ReviewStay[]>([]);

  const load = useCallback(() => {
    if (trip) getTripReview(trip).then(setStays);
  }, [trip]);
  useFocusEffect(useCallback(() => load(), [load]));

  const gaps = stays.filter((s) => !s.expense && s.review_status === "unreviewed").length;
  const logged = stays.filter((s) => s.expense || s.review_status !== "unreviewed").length;

  const hhmm = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-2 pb-16">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">Nightly review</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Done</Text>
            </Pressable>
          </View>
          <Eyebrow className="mt-1">
            {stays.length} stops · {logged} logged · {gaps ? `${gaps} to recall` : "all recalled"}
          </Eyebrow>
          <Rule className="mt-3" />

          {stays.map((s) => {
            const isGap = !s.expense && s.review_status === "unreviewed";
            return (
              <View key={s.id} className="py-3 border-t border-hair">
                <View className="flex-row items-center">
                  <Mono className="text-carbon text-xs w-14">{hhmm(s.arrived_at)}</Mono>
                  <Text className="text-ink font-semibold flex-1">{s.poi_name ?? "Stop"}</Text>
                  {s.expense ? (
                    <Money minor={s.expense.amount} currency={s.expense.currency} className="text-sm" />
                  ) : s.review_status === "no_spend" ? (
                    <Stamp tone="teal">no spend</Stamp>
                  ) : (
                    <Stamp tone="amber">gap</Stamp>
                  )}
                </View>

                {isGap ? (
                  <View className="mt-2">
                    <Text className="text-amber-ink font-bold mb-2">You stopped here. Spend anything?</Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/expense/new",
                            params: { tripId: trip, currency: "VND", stayId: s.id },
                          })
                        }
                        className="bg-amber rounded-md px-3 py-2"
                      >
                        <Text className="text-on-amber font-bold">+ Add expense</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          capture("gap_no_spend");
                          updateStayReview(s.id, "no_spend").then(load);
                        }}
                        className="border border-carbon rounded-md px-3 py-2"
                      >
                        <Text className="text-carbon">No spend</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          {stays.length === 0 ? (
            <Text className="text-carbon mt-4">
              No stops yet. Turn on tracking for this trip and your day will fill in here.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
