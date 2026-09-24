import { describe, expect, test } from "@/tests/vitest-fixtures";
import { resolveReferralPrefill } from "./register";

describe("resolveReferralPrefill", () => {
    test("prefers the URL ref over the install referrer", () => {
        expect(resolveReferralPrefill("URLCOD", "REFCOD")).toEqual({
            code: "URLCOD",
            source: "url",
        });
    });

    test("falls back to the install referrer when there is no URL ref", () => {
        expect(resolveReferralPrefill(undefined, "REFCOD")).toEqual({
            code: "REFCOD",
            source: "install_referrer",
        });
    });

    test("neither present: no code, source none", () => {
        expect(resolveReferralPrefill(undefined, undefined)).toEqual({
            code: undefined,
            source: "none",
        });
    });
});
