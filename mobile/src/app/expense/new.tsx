import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule } from "@/components/mb";
import { addExpense } from "@/lib/db/mutations";
import { getCategories } from "@/lib/db/queries";
import { parseAmount, format } from "@/lib/money";
import { fonts } from "@/lib/theme";
import { capture } from "@/lib/analytics";

export default function NewExpense() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const currency = "PHP"; // daily mode default; travel mode would pass the trip currency
  const [note, setNote] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [catId, setCatId] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCats);
  }, []);

  const minor = parseAmount(amount || "0", currency);

  const save = async () => {
    if (minor <= 0) return;
    await addExpense({ amountMinor: minor, currency, categoryId: catId, note: note || null });
    capture("expense_logged", { currency, has_category: catId != null });
    router.back();
  };

  return (
    <Screen>
      <ScrollView>
        <View className="px-5 pt-3">
          <View className="flex-row justify-between items-center">
            <Ritual className="text-2xl">New expense</Ritual>
            <Pressable onPress={() => router.back()}>
              <Text className="text-carbon">Cancel</Text>
            </Pressable>
          </View>
          <Rule className="mt-3" />

          <Eyebrow className="mt-5">Amount · {currency}</Eyebrow>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8A8578"
            autoFocus
            style={{ fontFamily: fonts.mono }}
            className="text-ink text-4xl py-2"
          />
          <Text className="text-teal text-lg" style={{ fontFamily: fonts.mono }}>
            {format(minor, currency)}
          </Text>

          <Eyebrow className="mt-6 mb-2">Category</Eyebrow>
          <View className="flex-row flex-wrap gap-2">
            {cats.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCatId(c.id === catId ? null : c.id)}
                className={`border rounded-md px-3 py-2 ${catId === c.id ? "border-ink bg-ink" : "border-hair"}`}
              >
                <Text className={catId === c.id ? "text-paper-lit" : "text-ink"}>{c.name}</Text>
              </Pressable>
            ))}
          </View>

          <Eyebrow className="mt-6 mb-1">Note</Eyebrow>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What was it?"
            placeholderTextColor="#8A8578"
            className="border border-hair rounded-md px-3 py-3 text-ink"
          />

          <Pressable
            onPress={save}
            disabled={minor <= 0}
            className={`rounded-md py-3.5 items-center mt-8 ${minor > 0 ? "bg-ink" : "bg-hair"}`}
          >
            <Text className="text-paper-lit font-bold">Log expense</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
