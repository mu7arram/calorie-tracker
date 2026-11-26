import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/nutrition/barcode/[code]/route";
import {
  clearBarcodeCache,
  hasValidGtinCheckDigit,
  inferPer100Unit,
  lookupBarcodeNutrition,
  normalizeBarcode,
  parseOpenFoodFactsProduct,
  resetBarcodeRateLimit,
} from "../barcode";

const originalFetch = globalThis.fetch;

describe("Barcode validation & Open Food Facts parser", () => {
  beforeEach(() => {
    clearBarcodeCache();
    resetBarcodeRateLimit();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearBarcodeCache();
    resetBarcodeRateLimit();
  });

  it("validates GTIN check digits across EAN-8, UPC-A, EAN-13, GTIN-14 and rejects invalid inputs", () => {
    assert.equal(hasValidGtinCheckDigit("96385074"), true); // EAN-8
    assert.equal(normalizeBarcode(" 049000-028904 "), "049000028904"); // UPC-A
    assert.equal(normalizeBarcode("5449000000996"), "5449000000996"); // EAN-13
    assert.equal(normalizeBarcode("10012345678902"), "10012345678902"); // GTIN-14

    // Bad check digits
    assert.equal(hasValidGtinCheckDigit("5449000000997"), false);
    assert.equal(normalizeBarcode("5449000000997"), null);
    assert.equal(normalizeBarcode("049000028905"), null);

    // Unsupported lengths & non-numeric strings
    assert.equal(normalizeBarcode("1234567"), null);
    assert.equal(normalizeBarcode("123456789"), null);
    assert.equal(normalizeBarcode("12345678901"), null);
    assert.equal(normalizeBarcode("abc12345678"), null);
    assert.equal(normalizeBarcode("123456789012345"), null);
  });

  it("prefers per-serving nutrition when serving size and serving calories exist", () => {
    const parsed = parseOpenFoodFactsProduct("0123456789012", {
      status: 1,
      product: {
        product_name: "Crunchy Protein Bar",
        brands: "PeakFit, PeakFit LLC",
        serving_size: "1 bar (45 G)",
        nutriments: {
          "energy-kcal_serving": 195.4,
          proteins_serving: 20.1,
          carbohydrates_serving: 18.2,
          fat_serving: 5.5,
          "energy-kcal_100g": 434,
          proteins_100g: 44.7,
          carbohydrates_100g: 40.4,
          fat_100g: 12.2,
        },
      },
    });

    assert.ok(parsed);
    assert.equal(parsed.model, "open-food-facts");
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].name, "PeakFit Crunchy Protein Bar");
    assert.equal(parsed.items[0].servingSize, "1 bar (45 G)");
    assert.deepEqual(parsed.totals, {
      calories: 195.4,
      protein: 20.1,
      carbs: 18.2,
      fat: 5.5,
    });
  });

  it("parses volume units (mL, L, Liters) and mass units explicitly for per-100 fallback", () => {
    assert.equal(inferPer100Unit("330 mL"), "100 ml");
    assert.equal(inferPer100Unit("0.33 L"), "100 ml");
    assert.equal(inferPer100Unit("1.5 Liters"), "100 ml");
    assert.equal(inferPer100Unit("500ml"), "100 ml");
    assert.equal(inferPer100Unit("45 G"), "100 g");
    assert.equal(inferPer100Unit("1 bottle", "0.33 L"), "100 ml");
    assert.equal(inferPer100Unit(null, "250 g"), "100 g");

    const parsed = parseOpenFoodFactsProduct("5449000000996", {
      status: 1,
      product: {
        product_name: "Sparkling Drink",
        serving_size: "0.33 L",
        nutriments: {
          "energy-kj_100g": 180,
          proteins_100g: 0,
          carbohydrates_100g: 10.6,
          fat_100g: 0,
        },
      },
    });

    assert.ok(parsed);
    assert.equal(parsed.items[0].servingSize, "100 ml");
    assert.equal(parsed.items[0].calories, 43);
    assert.equal(parsed.items[0].carbs, 10.6);
  });

  it("handles malformed nutriments, partial serving/100g fields, and kJ per-serving fallback", () => {
    // Serving energy present without serving_size falls back to per-100g
    const fallbackPartial = parseOpenFoodFactsProduct("5449000000996", {
      status: 1,
      product: {
        product_name: "Oat Biscuit",
        nutriments: {
          "energy-kcal_serving": 120,
          "energy-kcal_100g": "450.25",
          proteins_100g: "8.4",
          carbohydrates_100g: -5, // invalid negative clamped to 0
          fat_100g: "not-a-number",
        },
      },
    });

    assert.ok(fallbackPartial);
    assert.equal(fallbackPartial.items[0].servingSize, "100 g");
    assert.equal(fallbackPartial.items[0].calories, 450.3);
    assert.equal(fallbackPartial.items[0].protein, 8.4);
    assert.equal(fallbackPartial.items[0].carbs, 0);
    assert.equal(fallbackPartial.items[0].fat, 0);

    // kJ serving conversion + partial macros missing fat_serving defaults to 0
    const kjServing = parseOpenFoodFactsProduct("049000028904", {
      status: 1,
      product: {
        product_name: "Tonic Water",
        serving_size: "250 mL",
        nutriments: {
          "energy-kj_serving": 350,
          carbohydrates_serving: "20.5",
        },
      },
    });

    assert.ok(kjServing);
    assert.equal(kjServing.items[0].servingSize, "250 mL");
    assert.equal(kjServing.items[0].calories, 83.7);
    assert.equal(kjServing.items[0].protein, 0);
    assert.equal(kjServing.items[0].carbs, 20.5);
    assert.equal(kjServing.items[0].fat, 0);
  });

  it("returns null on unexpected payload types or missing energy data", () => {
    assert.equal(parseOpenFoodFactsProduct("96385074", null), null);
    assert.equal(parseOpenFoodFactsProduct("96385074", []), null);
    assert.equal(parseOpenFoodFactsProduct("96385074", "invalid"), null);
    assert.equal(parseOpenFoodFactsProduct("96385074", { status: "1" }), null);
    assert.equal(
      parseOpenFoodFactsProduct("96385074", { status: 1, product: null }),
      null
    );
    assert.equal(
      parseOpenFoodFactsProduct("96385074", { status: 1, product: [] }),
      null
    );
    assert.equal(parseOpenFoodFactsProduct("96385074", { status: 0 }), null);
    assert.equal(
      parseOpenFoodFactsProduct("96385074", {
        status: 1,
        product: { product_name: "Mystery Item", nutriments: { "energy-kcal_100g": "bad" } },
      }),
      null
    );
  });

  it("caches found and 404 responses in memory to deduplicate upstream calls", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response(
          JSON.stringify({
            status: 1,
            product: {
              product_name: "Cached Bar",
              serving_size: "1 bar (40 g)",
              nutriments: {
                "energy-kcal_serving": 160,
                proteins_serving: 10,
                carbohydrates_serving: 15,
                fat_serving: 6,
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const first = await lookupBarcodeNutrition("5449000000996");
    const second = await lookupBarcodeNutrition("5449000000996");
    assert.ok(first && second);
    assert.equal(second.items[0].name, "Cached Bar");
    assert.equal(fetchCalls, 1);

    const miss1 = await lookupBarcodeNutrition("049000028904");
    const miss2 = await lookupBarcodeNutrition("049000028904");
    assert.equal(miss1, null);
    assert.equal(miss2, null);
    assert.equal(fetchCalls, 2);
  });

  it("deduplicates concurrent in-flight lookups for the same uncached barcode", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name: "Concurrent Drink",
            serving_size: "250 mL",
            nutriments: {
              "energy-kcal_serving": 90,
              proteins_serving: 0,
              carbohydrates_serving: 22,
              fat_serving: 0,
            },
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const [a, b, c] = await Promise.all([
      lookupBarcodeNutrition("5449000000996"),
      lookupBarcodeNutrition("5449000000996"),
      lookupBarcodeNutrition("5449-0000-0099-6"),
    ]);

    assert.equal(fetchCalls, 1);
    assert.ok(a && b && c);
    assert.equal(a.items[0].name, "Concurrent Drink");
    assert.equal(b.items[0].name, "Concurrent Drink");
    assert.equal(c.items[0].name, "Concurrent Drink");
  });

  it("handles 400, 200, 404, 502, 500, and 429 responses on the API route", async () => {
    const makeRequest = (ip = "198.51.100.1") =>
      new NextRequest("http://localhost:3005/api/nutrition/barcode/5449000000996", {
        headers: { "x-forwarded-for": ip },
      });

    // 400 invalid check digit
    const res400 = await GET(makeRequest("198.51.100.10"), {
      params: Promise.resolve({ code: "5449000000997" }),
    });
    assert.equal(res400.status, 400);

    // 200 success + Cache-Control header
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name: "Spring Water Plus",
            serving_size: "500 mL",
            nutriments: {
              "energy-kcal_serving": 25,
              proteins_serving: 0,
              carbohydrates_serving: 6,
              fat_serving: 0,
            },
          },
        }),
        { status: 200 }
      )) as typeof fetch;

    const res200 = await GET(makeRequest("198.51.100.11"), {
      params: Promise.resolve({ code: "5449000000996" }),
    });
    assert.equal(res200.status, 200);
    assert.equal(res200.headers.get("cache-control"), "private, max-age=300");

    // 404 when upstream returns status: 0
    clearBarcodeCache();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: 0 }), { status: 200 })) as typeof fetch;
    const res404 = await GET(makeRequest("198.51.100.12"), {
      params: Promise.resolve({ code: "5449000000996" }),
    });
    assert.equal(res404.status, 404);

    // 502 when upstream fails with HTTP 503
    clearBarcodeCache();
    globalThis.fetch = (async () =>
      new Response("Service Unavailable", { status: 503 })) as typeof fetch;
    const res502 = await GET(makeRequest("198.51.100.13"), {
      params: Promise.resolve({ code: "5449000000996" }),
    });
    assert.equal(res502.status, 502);

    // 500 when an unexpected non-BarcodeUpstreamError occurs
    clearBarcodeCache();
    globalThis.fetch = (async () =>
      ({
        get status() {
          throw new Error("Unexpected internal failure");
        },
      }) as unknown as Response) as typeof fetch;
    const res500 = await GET(makeRequest("198.51.100.14"), {
      params: Promise.resolve({ code: "5449000000996" }),
    });
    assert.equal(res500.status, 500);

    // 429 after exceeding per-IP rate limit (30 requests per minute),
    // verifying x-vercel-forwarded-for takes precedence over spoofable x-forwarded-for
    for (let i = 0; i < 30; i += 1) {
      const ok = await GET(
        new NextRequest(
          "http://localhost:3005/api/nutrition/barcode/5449000000997",
          {
            headers: {
              "x-vercel-forwarded-for": "203.0.113.50",
              "x-forwarded-for": `198.51.100.${i + 1}`,
            },
          }
        ),
        { params: Promise.resolve({ code: "5449000000997" }) }
      );
      assert.equal(ok.status, 400);
    }
    const res429 = await GET(
      new NextRequest(
        "http://localhost:3005/api/nutrition/barcode/5449000000997",
        {
          headers: {
            "x-vercel-forwarded-for": "203.0.113.50",
            "x-forwarded-for": "198.51.100.250",
          },
        }
      ),
      { params: Promise.resolve({ code: "5449000000997" }) }
    );
    assert.equal(res429.status, 429);
    assert.ok(Number(res429.headers.get("retry-after")) >= 1);
  });
});
