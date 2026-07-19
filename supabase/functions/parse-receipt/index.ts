// Micro Budget — AI receipt parse (PAID tier). Keeps the Anthropic key off the
// device and enforces the free/paid gate server-side. Takes a base64 receipt
// image, returns structured JSON via Claude Haiku vision + structured outputs.
//
// Deploy:  supabase functions deploy parse-receipt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// JWT verification is on by default, so only signed-in users reach this. The
// free/paid entitlement check is a TODO below (wire to a `profiles.tier` row).
import Anthropic from "npm:@anthropic-ai/sdk@^0.68.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Guardrails: Claude vision caps images ~5MB; base64 inflates bytes ~1.37×.
const MAX_BASE64_LEN = 7_000_000; // ≈ 5 MB decoded
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "total", "currency", "date", "line_items"],
  properties: {
    merchant: { type: "string", description: "store / vendor name, or empty string if unknown" },
    total: {
      type: "number",
      description: "grand total in MAJOR currency units (e.g. 220000 for VND, 185.5 for PHP). 0 if unreadable",
    },
    currency: { type: "string", description: "best-guess ISO 4217 code (PHP, VND, USD, ...)" },
    date: { type: "string", description: "purchase date as YYYY-MM-DD, or empty string if unknown" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "amount"],
        properties: {
          description: { type: "string" },
          amount: { type: "number", description: "line amount in major units" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      // Don't echo the secret's name/state to the client — log it server-side only.
      console.error("parse-receipt: ANTHROPIC_API_KEY is not set");
      return json({ error: "Receipt scanning is temporarily unavailable." }, 500);
    }

    // TODO(paid-gate): look up the caller's entitlement (profiles.tier / RevenueCat)
    // and 402 if they're on the free tier. JWT verification already blocks anon.

    const { imageBase64, mediaType } = await req.json().catch(() => ({}));
    if (typeof imageBase64 !== "string" || !imageBase64) {
      return json({ error: "imageBase64 is required" }, 400);
    }
    if (imageBase64.length > MAX_BASE64_LEN) {
      return json({ error: "Image is too large (max ~5 MB)." }, 413);
    }
    // MIME types are case-insensitive (RFC 6838); normalise before the allowlist
    // check and before handing the value to Anthropic, which expects lowercase.
    const media = (typeof mediaType === "string" && mediaType ? mediaType : "image/jpeg").toLowerCase();
    if (!ALLOWED_MEDIA.has(media)) {
      return json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." }, 415);
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5", // per the build plan: cheap vision for the paid receipt tier
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: media, data: imageBase64 },
            },
            {
              type: "text",
              text:
                "Extract the receipt's merchant, grand total, ISO-4217 currency code, purchase date, " +
                "and line items. Totals are in MAJOR units of the receipt's own currency " +
                "(VND has no decimals; PHP/USD have two). If a field is unreadable, use an empty string or 0.",
            },
          ],
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    const parsed = block && "text" in block ? JSON.parse(block.text) : null;
    return json({ parsed, model: response.model });
  } catch (e) {
    // Log the detail server-side; return a generic message so we never leak
    // internals (key state, upstream errors) to the client.
    console.error("parse-receipt failed:", e);
    return json({ error: "Failed to parse the receipt. Please try again." }, 500);
  }
});
