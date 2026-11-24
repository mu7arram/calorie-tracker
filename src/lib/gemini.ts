import { round1 } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import type {
  DailyTotals,
  NutritionEstimateItem,
  NutritionLookupResponse,
} from "@/types/food";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const NUTRITION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Short human-readable summary of the meal or foods analyzed.",
    },
    items: {
      type: "array",
      description: "List of identified food items with estimated nutrition.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Food item name.",
          },
          servingSize: {
            type: "string",
            description: "Estimated portion or serving size (e.g. '150g', '1 cup').",
          },
          calories: {
            type: "number",
            description: "Estimated calories in kcal.",
          },
          protein: {
            type: "number",
            description: "Estimated protein in grams.",
          },
          carbs: {
            type: "number",
            description: "Estimated carbohydrates in grams.",
          },
          fat: {
            type: "number",
            description: "Estimated fat in grams.",
          },
        },
        required: ["name", "servingSize", "calories", "protein", "carbs", "fat"],
      },
    },
  },
  required: ["summary", "items"],
};

const SYSTEM_INSTRUCTION =
  "You are a precise nutrition estimation assistant. Given a meal description or meal photo, break it down into individual food items with realistic USDA-based portion sizes, calories (kcal), protein (g), carbs (g), and fat (g). Always return valid JSON matching the requested schema.";

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export class GeminiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiUpstreamError";
  }
}

type FetchFn = typeof fetch;

function getLanguageDirective(locale: Locale): string {
  if (locale === "es") {
    return "Respond in natural Spanish for summary, items[].name, and items[].servingSize (e.g., '150 g', '1 taza'). Keep all JSON keys strictly in English.";
  }
  if (locale === "ar") {
    return "Respond in natural Modern Standard Arabic for summary, items[].name, and items[].servingSize using Arabic units (e.g., '150 غ', 'كوب واحد') and Western digits (0-9). Keep all JSON keys strictly in English.";
  }
  return "Respond in English using standard serving size descriptions (e.g., '150g', '1 cup').";
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!apiKey || apiKey === "your-key-here") {
    throw new GeminiConfigError("GEMINI_API_KEY is not configured on the server");
  }
  return apiKey;
}

function sanitizeNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return round1(value);
}

export function normalizeNutritionPayload(rawText: string): NutritionLookupResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new GeminiUpstreamError("Gemini returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new GeminiUpstreamError("Gemini returned an unexpected payload shape");
  }

  const record = parsed as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];

  const items: NutritionEstimateItem[] = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : "Unknown food",
      servingSize:
        typeof item.servingSize === "string" && item.servingSize.trim()
          ? item.servingSize.trim()
          : "1 serving",
      calories: sanitizeNonNegativeNumber(item.calories),
      protein: sanitizeNonNegativeNumber(item.protein),
      carbs: sanitizeNonNegativeNumber(item.carbs),
      fat: sanitizeNonNegativeNumber(item.fat),
    }));

  if (items.length === 0) {
    throw new GeminiUpstreamError("No food items could be identified");
  }

  const totals: DailyTotals = items.reduce(
    (acc, item) => ({
      calories: round1(acc.calories + item.calories),
      protein: round1(acc.protein + item.protein),
      carbs: round1(acc.carbs + item.carbs),
      fat: round1(acc.fat + item.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const summary =
    typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim()
      : items.map((item) => item.name).join(", ");

  return {
    summary,
    totals,
    items,
    model: GEMINI_MODEL,
  };
}

async function callGemini(
  parts: Array<Record<string, unknown>>,
  fetchImpl: FetchFn = fetch
): Promise<NutritionLookupResponse> {
  const apiKey = getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: NUTRITION_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(
      `Gemini API error (${response.status}):`,
      errorBody.slice(0, 300)
    );
    throw new GeminiUpstreamError(
      `Gemini API request failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiUpstreamError("Gemini returned an empty response");
  }

  return normalizeNutritionPayload(text);
}

export async function estimateNutritionFromText(
  description: string,
  localeOrFetch: Locale | FetchFn = "en",
  fetchImplArg?: FetchFn
): Promise<NutritionLookupResponse> {
  const locale: Locale =
    typeof localeOrFetch === "function" ? "en" : localeOrFetch;
  const fetchImpl =
    typeof localeOrFetch === "function" ? localeOrFetch : (fetchImplArg ?? fetch);

  return callGemini(
    [
      {
        text: `Estimate the nutrition breakdown for this meal description: "${description}". ${getLanguageDirective(locale)}`,
      },
    ],
    fetchImpl
  );
}

export async function estimateNutritionFromImage(
  params: {
    base64Data: string;
    mimeType: string;
    notes?: string;
    locale?: Locale;
  },
  fetchImpl: FetchFn = fetch
): Promise<NutritionLookupResponse> {
  const locale = params.locale ?? "en";
  const directive = getLanguageDirective(locale);
  const promptText = params.notes
    ? `Identify all foods in this meal photo and estimate their nutrition. Additional context from user: "${params.notes}". ${directive}`
    : `Identify all foods in this meal photo and estimate their nutrition. ${directive}`;

  return callGemini(
    [
      { text: promptText },
      {
        inlineData: {
          mimeType: params.mimeType,
          data: params.base64Data,
        },
      },
    ],
    fetchImpl
  );
}
