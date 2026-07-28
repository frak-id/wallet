import { describe, expect, test } from "@/tests/vitest-fixtures";
import { conversionRateQueryKey, tokenMetadataQueryKey } from "./queryKeys";

describe("common hook query keys", () => {
    test("builders return the exact tuples the call sites inlined", () => {
        expect(conversionRateQueryKey("0xtoken", false)).toEqual([
            "conversionRate",
            "0xtoken",
            "live",
        ]);
        expect(conversionRateQueryKey("0xtoken", true)).toEqual([
            "conversionRate",
            "0xtoken",
            "demo",
        ]);
        expect(tokenMetadataQueryKey("0xtoken")).toEqual([
            "tokenMetadata",
            "0xtoken",
        ]);
    });
});
