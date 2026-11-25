import type { NutritionEstimateItem, NutritionLookupResponse } from "@/types/food";

const BARCODE_DIGITS_PATTERN = /^\d{8,14}$/;
const KJ_PER_KCAL = 4.184;
const OPEN_FOOD_FACTS_BASE =
  "https://world.openfoodfacts.org/api/v2/product";

export class BarcodeUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcodeUpstreamError";
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * Strips whitespace and hyphens, returning a clean 8–14 digit UPC/EAN/GTIN
 * barcode or null if invalid.
 */
export function normalizeBarcode(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]+/g, "").trim();
  if (!BARCODE_DIGITS_PATTERN.test(cleaned)) {
    return null;
  }
  return cleaned;
}

interface OpenFoodFactsNutriments {
  "energy-kcal_serving"?: unknown;
  "energy-kj_serving"?: unknown;
  proteins_serving?: unknown;
  carbohydrates_serving?: unknown;
  fat_serving?: unknown;
  "energy-kcal_100g"?: unknown;
  "energy-kj_100g"?: unknown;
  proteins_100g?: unknown;
  carbohydrates_100g?: unknown;
  fat_100g?: unknown;
}

interface OpenFoodFactsProduct {
  product_name?: unknown;
  product_name_en?: unknown;
  generic_name?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  nutriments?: OpenFoodFactsNutriments;
}

interface OpenFoodFactsResponse {
  status?: unknown;
  product?: OpenFoodFactsProduct;
}

function extractKcal(kcalRaw: unknown, kjRaw: unknown): number | null {
  const kcal = toNonNegativeNumber(kcalRaw);
  if (kcal !== null) return kcal;
  const kj = toNonNegativeNumber(kjRaw);
  if (kj !== null) return kj / KJ_PER_KCAL;
  return null;
}

/**
 * Normalizes an Open Food Facts API product payload into NutritionLookupResponse.
 */
export function parseOpenFoodFactsProduct(
  code: string,
  payload: unknown
): NutritionLookupResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as OpenFoodFactsResponse;
  if (
    record.status !== 1 ||
    !record.product ||
    typeof record.product !== "object"
  ) {
    return null;
  }

  const product = record.product;
  const nutriments = product.nutriments ?? {};

  const servingKcal = extractKcal(
    nutriments["energy-kcal_serving"],
    nutriments["energy-kj_serving"]
  );
  const per100Kcal = extractKcal(
    nutriments["energy-kcal_100g"],
    nutriments["energy-kj_100g"]
  );

  const rawServingSize =
    typeof product.serving_size === "string" &&
    product.serving_size.trim().length > 0
      ? product.serving_size.trim()
      : null;

  const useServing = servingKcal !== null && rawServingSize !== null;
  const calories = useServing ? servingKcal : per100Kcal;
  if (calories === null) {
    return null;
  }

  const protein =
    (useServing
      ? toNonNegativeNumber(nutriments.proteins_serving)
      : toNonNegativeNumber(nutriments.proteins_100g)) ?? 0;
  const carbs =
    (useServing
      ? toNonNegativeNumber(nutriments.carbohydrates_serving)
      : toNonNegativeNumber(nutriments.carbohydrates_100g)) ?? 0;
  const fat =
    (useServing
      ? toNonNegativeNumber(nutriments.fat_serving)
      : toNonNegativeNumber(nutriments.fat_100g)) ?? 0;

  const baseName =
    [product.product_name, product.product_name_en, product.generic_name]
      .find((v): v is string => typeof v === "string" && v.trim().length > 0)
      ?.trim() ?? `Barcode ${code}`;

  const primaryBrand =
    typeof product.brands === "string" && product.brands.trim().length > 0
      ? product.brands.split(",")[0].trim()
      : "";

  const displayName =
    primaryBrand &&
    !baseName.toLowerCase().includes(primaryBrand.toLowerCase())
      ? `${primaryBrand} ${baseName}`
      : baseName;

  const servingSize = useServing
    ? rawServingSize
    : rawServingSize && /\bml\b/i.test(rawServingSize)
      ? "100 ml"
      : "100 g";

  const item: NutritionEstimateItem = {
    name: displayName.slice(0, 200),
    servingSize: servingSize.slice(0, 120),
    calories: round1(calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };

  return {
    summary: `${item.name} (${item.servingSize})`,
    totals: {
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    },
    items: [item],
    model: "open-food-facts",
  };
}

/**
 * Fetches nutrition details for a normalized barcode from Open Food Facts.
 */
export async function lookupBarcodeNutrition(
  code: string
): Promise<NutritionLookupResponse | null> {
  const normalized = normalizeBarcode(code);
  if (!normalized) {
    return null;
  }

  const fields =
    "product_name,product_name_en,generic_name,brands,serving_size,nutriments";
  const url = `${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(normalized)}.json?fields=${fields}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "CalorieTracker/1.0 (https://github.com/mu7arram/calorie-tracker)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new BarcodeUpstreamError(
      error instanceof Error
        ? `Open Food Facts lookup failed: ${error.message}`
        : "Open Food Facts lookup failed"
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new BarcodeUpstreamError(
      `Open Food Facts returned HTTP ${response.status}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BarcodeUpstreamError(
      "Invalid JSON response from Open Food Facts"
    );
  }

  return parseOpenFoodFactsProduct(normalized, data);
}
