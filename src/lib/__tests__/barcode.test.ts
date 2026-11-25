import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBarcode, parseOpenFoodFactsProduct } from "../barcode";

describe("Barcode validation & Open Food Facts parser", () => {
  it("normalizes valid UPC/EAN barcodes and rejects invalid inputs", () => {
    assert.equal(normalizeBarcode(" 049000-028904 "), "049000028904");
    assert.equal(normalizeBarcode("5449000000996"), "5449000000996");
    assert.equal(normalizeBarcode("1234567"), null);
    assert.equal(normalizeBarcode("abc12345678"), null);
    assert.equal(normalizeBarcode("123456789012345"), null);
  });

  it("prefers per-serving nutrition when serving size and serving calories exist", () => {
    const parsed = parseOpenFoodFactsProduct("0123456789012", {
      status: 1,
      product: {
        product_name: "Crunchy Protein Bar",
        brands: "PeakFit, PeakFit LLC",
        serving_size: "1 bar (45 g)",
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
    assert.equal(parsed.items[0].servingSize, "1 bar (45 g)");
    assert.deepEqual(parsed.totals, {
      calories: 195.4,
      protein: 20.1,
      carbs: 18.2,
      fat: 5.5,
    });
  });

  it("falls back to per-100g and converts kJ to kcal when kcal is missing", () => {
    const parsed = parseOpenFoodFactsProduct("5449000000996", {
      status: 1,
      product: {
        product_name: "Sparkling Drink",
        serving_size: "330 ml",
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

  it("returns null when product is missing or lacks energy data", () => {
    assert.equal(parseOpenFoodFactsProduct("00000000", { status: 0 }), null);
    assert.equal(
      parseOpenFoodFactsProduct("00000000", {
        status: 1,
        product: { product_name: "Mystery Item", nutriments: {} },
      }),
      null
    );
  });
});
