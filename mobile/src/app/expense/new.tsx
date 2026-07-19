import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Screen, Eyebrow, Ritual, Rule, Stamp } from "@/components/mb";
import { addExpense, addReceipt } from "@/lib/db/mutations";
import { getCategories } from "@/lib/db/queries";
import { parseAmount, format, toMajor } from "@/lib/money";
import { fonts } from "@/lib/theme";
import { capture } from "@/lib/analytics";
import { captureReceipt } from "@/lib/receipt/capture";
import { parseReceiptWithAI } from "@/lib/receipt/ai";

export default function NewExpense() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string; currency?: string; stayId?: string }>();
  const [amount, setAmount] = useState("");
  // daily mode defaults to home currency; a trip gap passes the trip's currency
  const currency = typeof params.currency === "string" && params.currency ? params.currency : "PHP";
  const [note, setNote] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [catId, setCatId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCats);
  }, []);

  const minor = parseAmount(amount || "0", currency);

  const save = async () => {
    if (minor <= 0) return;
    await addExpense({
      amountMinor: minor,
      currency,
      categoryId: catId,
      note: note || null,
      receiptId,
      tripId: typeof params.tripId === "string" ? params.tripId : null,
      stayId: typeof params.stayId === "string" ? params.stayId : null,
    });
    capture("expense_logged", { currency, has_category: catId != null, has_receipt: receiptId != null });
    router.back();
  };

  // PAID tier: photo -> Edge Function (Claude vision) -> prefilled expense.
  const scanAI = async () => {
    const cap = await captureReceipt("camera");
    if (!cap) return;
    setScanning(true);
    setScanMsg("Reading receipt…");
    try {
      const ai = await parseReceiptWithAI(cap.base64, cap.mediaType);
      const rid = await addReceipt({
        imageLocalPath: cap.uri,
        parsedJson: ai ? JSON.stringify(ai) : null,
        parseMethod: ai ? "ai" : "manual",
        status: ai ? "parsed" : "unprocessed",
      });
      setReceiptId(rid);
      if (ai) {
        if (ai.merchant) setNote(ai.merchant);
        if (ai.totalMinor != null && ai.currency) {
          setAmount(String(toMajor(ai.totalMinor, ai.currency)));
          setScanMsg(
            `Scanned: ${ai.merchant ?? "receipt"} · ${format(ai.totalMinor, ai.currency)}` +
              (ai.currency !== currency ? " — foreign currency, check the amount" : ""),
          );
        } else {
          setScanMsg("Scanned, but the total wasn't clear. Enter it manually.");
        }
        capture("receipt_ai_parsed");
      } else {
        setScanMsg("Photo attached. AI parse is unavailable — enter details manually.");
      }
    } catch {
      setScanMsg("Couldn't parse the receipt. Enter details manually.");
    } finally {
      setScanning(false);
    }
  };

  // FREE tier: attach a photo now, sort it later (on-device OCR is deferred).
  const attach = async () => {
    const cap = await captureReceipt("library");
    if (!cap) return;
    const rid = await addReceipt({ imageLocalPath: cap.uri, parseMethod: "manual", status: "unprocessed" });
    setReceiptId(rid);
    setScanMsg("Photo attached.");
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

          <Eyebrow className="mt-6 mb-2">Receipt</Eyebrow>
          <View className="flex-row gap-2 items-stretch">
            <Pressable
              onPress={scanAI}
              disabled={scanning}
              className="flex-1 flex-row items-center justify-center gap-2 border-[1.5px] border-ink rounded-md py-3"
            >
              <Text className="text-ink font-bold">{scanning ? "Scanning…" : "Scan with AI"}</Text>
              <Stamp tone="amber">Pro</Stamp>
            </Pressable>
            <Pressable onPress={attach} className="border border-hair rounded-md py-3 px-4 justify-center">
              <Text className="text-carbon">Attach</Text>
            </Pressable>
          </View>
          {scanMsg ? <Text className="text-carbon text-xs mt-2">{scanMsg}</Text> : null}

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
