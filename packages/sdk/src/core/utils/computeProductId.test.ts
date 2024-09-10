import { describe, expect, test } from "vitest";
import { computeProductId } from "./computeProductId";

describe("computeProductId", () => {
    test("should return domain name to Hex value", () => {
        expect(computeProductId({ domain: "test.com" })).toBe(
            "0xb708c1f6e300073b25faa047dd354a550916ad30b4929c92d1822a0595a4afde"
        );
    });
});
