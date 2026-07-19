import { supabase, isSupabaseConfigured } from "../supabase";
import { toMinor } from "../money";

export type AiReceipt = {
  merchant: string | null;
  totalMinor: number | null;
  currency: string | null;
  date: string | null;
  lineItems: { description: string; amountMinor: number }[];
};

type RawItem = { description?: unknown; amount?: unknown };

/** PAID tier: send the image to the parse-receipt Edge Function (Claude vision).
 * Returns null when Supabase isn't configured or parsing fails. */
export async function parseReceiptWithAI(
  imageBase64: string,
  mediaType: string,
): Promise<AiReceipt | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.functions.invoke("parse-receipt", {
    body: { imageBase64, mediaType },
  });
  if (error || !data || !data.parsed) return null;

  const p = data.parsed as {
    merchant?: string;
    total?: number;
    currency?: string;
    date?: string;
    line_items?: RawItem[];
  };
  const currency = (p.currency ?? "").toUpperCase() || null;
  const totalMinor =
    currency && typeof p.total === "number" && p.total > 0
      ? toMinor(p.total, currency)
      : null;

  return {
    merchant: p.merchant?.trim() || null,
    totalMinor,
    currency,
    date: p.date?.trim() || null,
    lineItems: Array.isArray(p.line_items)
      ? p.line_items.map((li) => ({
          description: String(li.description ?? ""),
          amountMinor: currency ? toMinor(Number(li.amount) || 0, currency) : 0,
        }))
      : [],
  };
}
