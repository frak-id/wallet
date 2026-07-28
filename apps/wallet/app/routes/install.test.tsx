import { describe, expect, test } from "@/tests/vitest-fixtures";
import { parseInstallProofFragment } from "./install";

describe("parseInstallProofFragment", () => {
    test("returns undefined when there is no fragment", () => {
        expect(parseInstallProofFragment("")).toBeUndefined();
    });

    test("returns undefined for an empty fragment", () => {
        expect(parseInstallProofFragment("#")).toBeUndefined();
    });

    test("returns undefined for a malformed fragment (no key=value)", () => {
        expect(parseInstallProofFragment("#not-a-query")).toBeUndefined();
    });

    test("returns undefined when p is absent but other keys are present", () => {
        expect(parseInstallProofFragment("#foo=bar&baz=qux")).toBeUndefined();
    });

    test("parses p alongside unrelated keys", () => {
        expect(parseInstallProofFragment("#foo=bar&p=abc123&baz=qux")).toBe(
            "abc123"
        );
    });

    test("parses a bare p fragment", () => {
        expect(parseInstallProofFragment("#p=abc123")).toBe("abc123");
    });

    test("accepts the fragment with or without the leading '#'", () => {
        expect(parseInstallProofFragment("p=abc123")).toBe("abc123");
    });

    test("never throws on pathological input", () => {
        expect(() => parseInstallProofFragment("#%%%invalid%%%")).not.toThrow();
        expect(() => parseInstallProofFragment("#=====")).not.toThrow();
    });
});
