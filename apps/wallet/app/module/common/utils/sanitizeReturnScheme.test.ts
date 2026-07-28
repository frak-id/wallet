import { describe, expect, it } from "vitest";
import { sanitizeReturnScheme } from "./sanitizeReturnScheme";

describe("sanitizeReturnScheme", () => {
    it("accepts a well-formed scheme", () => {
        expect(sanitizeReturnScheme("frak-acme")).toBe("frak-acme");
        expect(sanitizeReturnScheme("frak-acme.store_1-2")).toBe(
            "frak-acme.store_1-2"
        );
    });

    it("rejects a scheme without the frak prefix", () => {
        expect(sanitizeReturnScheme("some-banking-app")).toBeUndefined();
        expect(sanitizeReturnScheme("frak")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-")).toBeUndefined();
    });

    it("rejects uppercase, since schemes are compared lowercased", () => {
        expect(sanitizeReturnScheme("frak-Acme")).toBeUndefined();
    });

    it("rejects anything carrying URL structure", () => {
        expect(sanitizeReturnScheme("frak-acme://result")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-acme/../evil")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-a?x=1")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-a#frag")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-a b")).toBeUndefined();
    });

    it("rejects a newline-smuggled suffix", () => {
        // A trailing newline is the classic way past a `$`-anchored pattern in
        // engines where `$` also matches before a final line break.
        expect(sanitizeReturnScheme("frak-acme\n")).toBeUndefined();
        expect(sanitizeReturnScheme("frak-acme\nevil")).toBeUndefined();
    });

    it("rejects an over-long scheme", () => {
        expect(sanitizeReturnScheme(`frak-${"a".repeat(60)}`)).toBe(
            `frak-${"a".repeat(60)}`
        );
        expect(sanitizeReturnScheme(`frak-${"a".repeat(61)}`)).toBeUndefined();
    });

    it("rejects non-string input", () => {
        expect(sanitizeReturnScheme(undefined)).toBeUndefined();
        expect(sanitizeReturnScheme(null)).toBeUndefined();
        expect(sanitizeReturnScheme(123)).toBeUndefined();
        expect(sanitizeReturnScheme({})).toBeUndefined();
    });
});
