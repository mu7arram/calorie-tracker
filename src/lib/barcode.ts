import type { NutritionEstimateItem, NutritionLookupResponse } from "@/types/food";

const GTIN_PATTERN = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;
const KJ_PER_KCAL = 4.184;
const OPEN_FOOD_FACTS_BASE =
  "https://world.openfoodfacts.org/api/v2/product";

const FOUND_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NOT_FOUND_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_CACHE_ENTRIES = 500;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_RATE_LIMIT_KEYS = 1000;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// Best-effort module-local stores per serverless instance (acceptable for
// low-volume/hobby deployments; move to Upstash Redis / Vercel Firewall if
// strict multi-instance coordination is needed).
const rateLimitStore = new Map<string, RateLimitBucket>();
const barcodeCache = new Map<string, CacheEntry>();
const inFlightLookups = new Map<
  string,
  Promise<NutritionLookupResponse | null>
>();

export class BarcodeUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcodeUpstreamError";
  }
}

export function clearBarcodeCache(): void {
  barcodeCache.clear();
  inFlightLookups.clear();
}

export function resetBarcodeRateLimit(): void {
  rateLimitStore.clear();
}

/**
 * Checks and increments the per-client sliding-window quota for barcode lookups.
 */
export function checkBarcodeRateLimit(
  clientKey: string,
  now: number = Date.now()
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const existing = rateLimitStore.get(clientKey);
  if (!existing || now >= existing.resetAt) {
    if (rateLimitStore.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [key, bucket] of rateLimitStore.entries()) {
        if (now >= bucket.resetAt) {
          rateLimitStore.delete(key);
        }
      }
      if (rateLimitStore.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = rateLimitStore.keys().next().value;
        if (oldestKey !== undefined) {
          rateLimitStore.delete(oldestKey);
        }
      }
    }

    rateLimitStore.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

const VOLUME_UNIT_PATTERN =
  /(?:^|[\s(\d])(?:ml|cl|dl|fl\.?\s*oz|millilit(?:er|re)s?|lit(?:er|re)s?)(?=$|[\s),.;/])|(?:^|[\s(])\d+(?:[.,]\d+)?\s*l(?=$|[\s),.;/])/i;
const MASS_UNIT_PATTERN =
  /(?:^|[\s(\d])(?:mg|kg|oz|lb|lbs|grams?|kilograms?|milligrams?)(?=$|[\s),.;/])|(?:^|[\s(])\d+(?:[.,]\d+)?\s*g(?=$|[\s),.;/])/i;

interface CacheEntry {
  value: NutritionLookupResponse | null;
  expiresAt: number;
}

function getCachedLookup(
  code: string
): { hit: true; value: NutritionLookupResponse | null } | { hit: false } {
  const entry = barcodeCache.get(code);
  if (!entry) {
    return { hit: false };
  }
  if (Date.now() > entry.expiresAt) {
    barcodeCache.delete(code);
    return { hit: false };
  }
  return { hit: true, value: entry.value };
}

function setCachedLookup(
  code: string,
  value: NutritionLookupResponse | null
): void {
  if (barcodeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = barcodeCache.keys().next().value;
    if (oldestKey !== undefined) {
      barcodeCache.delete(oldestKey);
    }
  }
  const ttl = value ? FOUND_CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS;
  barcodeCache.set(code, { value, expiresAt: Date.now() + ttl });
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
 * Validates standard GS1 Mod-10 check digit for EAN-8, UPC-A, EAN-13, and GTIN-14.
 */
export function hasValidGtinCheckDigit(digits: string): boolean {
  if (!GTIN_PATTERN.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = digits.length - 2; i >= 0; i -= 1) {
    const weight = (digits.length - 2 - i) % 2 === 0 ? 3 : 1;
    sum += Number(digits[i]) * weight;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[digits.length - 1]);
}

/**
 * Strips whitespace and hyphens, returning a clean GS1-valid barcode
 * (EAN-8, UPC-A, EAN-13, or GTIN-14) or null if invalid.
 */
export function normalizeBarcode(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]+/g, "").trim();
  if (!GTIN_PATTERN.test(cleaned) || !hasValidGtinCheckDigit(cleaned)) {
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
  quantity?: unknown;
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
 * Determines whether per-100 fallback values represent liquid ("100 ml")
 * or solid ("100 g") nutrition using explicit volume/mass unit cues.
 */
export function inferPer100Unit(
  servingSize: string | null,
  quantity?: unknown
): "100 ml" | "100 g" {
  const candidates = [
    servingSize,
    typeof quantity === "string" ? quantity.trim() : null,
  ].filter((v): v is string => Boolean(v && v.length > 0));

  for (const text of candidates) {
    const hasVolume = VOLUME_UNIT_PATTERN.test(text);
    const hasMass = MASS_UNIT_PATTERN.test(text);
    if (hasVolume && !hasMass) {
      return "100 ml";
    }
    if (hasMass) {
      return "100 g";
    }
  }

  return "100 g";
}

/**
 * Normalizes an Open Food Facts API product payload into NutritionLookupResponse.
 */
export function parseOpenFoodFactsProduct(
  code: string,
  payload: unknown
): NutritionLookupResponse | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as OpenFoodFactsResponse;
  if (
    record.status !== 1 ||
    !record.product ||
    typeof record.product !== "object" ||
    Array.isArray(record.product)
  ) {
    return null;
  }

  const product = record.product;
  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? product.nutriments
      : {};

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
    : inferPer100Unit(rawServingSize, product.quantity);

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
 * Fetches nutrition details for a normalized barcode from Open Food Facts,
 * backed by a short-lived in-memory TTL cache to reduce upstream quota load.
 */
export async function lookupBarcodeNutrition(
  code: string
): Promise<NutritionLookupResponse | null> {
  const normalized = normalizeBarcode(code);
  if (!normalized) {
    return null;
  }

  const cached = getCachedLookup(normalized);
  if (cached.hit) {
    return cached.value;
  }

  const existingInFlight = inFlightLookups.get(normalized);
  if (existingInFlight) {
    return existingInFlight;
  }

  const requestPromise = (async (): Promise<NutritionLookupResponse | null> => {
    const fields =
      "product_name,product_name_en,generic_name,brands,serving_size,quantity,nutriments";
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
      setCachedLookup(normalized, null);
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

    const parsed = parseOpenFoodFactsProduct(normalized, data);
    setCachedLookup(normalized, parsed);
    return parsed;
  })();

  inFlightLookups.set(normalized, requestPromise);
  try {
    return await requestPromise;
  } finally {
    if (inFlightLookups.get(normalized) === requestPromise) {
      inFlightLookups.delete(normalized);
    }
  }
}
