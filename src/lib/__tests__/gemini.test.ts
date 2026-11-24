import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  estimateNutritionFromImage,
  estimateNutritionFromText,
  GEMINI_MODEL,
  GeminiConfigError,
  GeminiUpstreamError,
  normalizeNutritionPayload,
} from "../gemini";

const originalApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalApiKey;
  }
});

describe("Gemini nutrition service", () => {
  it("normalizes items, sanitizes invalid numbers, and computes rounded totals", () => {
    const raw = JSON.stringify({
      summary: "Chicken rice bowl",
      items: [
        {
          name: "Grilled Chicken Breast",
          servingSize: "150g",
          calories: 247.54,
          protein: 46.5,
          carbs: 0,
          fat: 5.42,
        },
        {
          name: "White Rice",
          servingSize: "1 cup",
          calories: 205,
          protein: 4.3,
          carbs: 44.5,
          fat: -1, // negative values should sanitize to 0
        },
      ],
    });

    const result = normalizeNutritionPayload(raw);
    assert.equal(result.model, GEMINI_MODEL);
    assert.equal(result.summary, "Chicken rice bowl");
    assert.equal(result.items.length, 2);
    assert.equal(result.items[1].fat, 0);
    assert.deepEqual(result.totals, {
      calories: 452.5,
      protein: 50.8,
      carbs: 44.5,
      fat: 5.4,
    });
  });

  it("throws GeminiUpstreamError when Gemini returns empty items", () => {
    assert.throws(
      () => normalizeNutritionPayload(JSON.stringify({ summary: "Nothing", items: [] })),
      GeminiUpstreamError
    );
  });

  it("throws GeminiConfigError when GEMINI_API_KEY is missing or placeholder", async () => {
    process.env.GEMINI_API_KEY = "your-key-here";
    await assert.rejects(
      () => estimateNutritionFromText("2 eggs"),
      GeminiConfigError
    );
  });

  it("calls Gemini REST endpoint with structured schema for text and image requests", async () => {
    process.env.GEMINI_API_KEY = "test-secret-key";

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "2 boiled eggs",
                      items: [
                        {
                          name: "Boiled Egg",
                          servingSize: "2 large",
                          calories: 144,
                          protein: 12.6,
                          carbs: 0.8,
                          fat: 9.6,
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const textResult = await estimateNutritionFromText("2 boiled eggs", mockFetch);
    assert.ok(capturedUrl.includes(`/${GEMINI_MODEL}:generateContent`));
    assert.equal(capturedHeaders["x-goog-api-key"], "test-secret-key");
    assert.equal(textResult.totals.calories, 144);

    const imageResult = await estimateNutritionFromImage(
      { base64Data: "ZmFrZQ==", mimeType: "image/jpeg" },
      mockFetch
    );
    const contents = capturedBody.contents as Array<{ parts: Array<Record<string, unknown>> }>;
    assert.ok(contents[0].parts.some((part) => "inlineData" in part));
    assert.equal(imageResult.items[0].name, "Boiled Egg");

    await estimateNutritionFromText("صدر دجاج", "ar", mockFetch);
    const arContents = capturedBody.contents as Array<{ parts: Array<{ text?: string }> }>;
    assert.ok(arContents[0].parts[0].text?.includes("Modern Standard Arabic"));

    await estimateNutritionFromImage(
      { base64Data: "ZmFrZQ==", mimeType: "image/png", locale: "es" },
      mockFetch
    );
    const esContents = capturedBody.contents as Array<{ parts: Array<{ text?: string }> }>;
    assert.ok(esContents[0].parts[0].text?.includes("natural Spanish"));
  });
});

