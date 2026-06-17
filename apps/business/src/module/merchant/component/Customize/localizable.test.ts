import type { LocalizableString } from "@frak-labs/backend-elysia/domain/merchant";
import { describe, expect, it } from "vitest";
import { fromLocalizedText, toLocalizedText } from "./localizable";

describe("toLocalizedText", () => {
    it("returns blank tiers for an unset value", () => {
        expect(toLocalizedText(undefined)).toEqual({
            default: "",
            en: "",
            fr: "",
        });
    });

    it("loads a bare string into the default tier", () => {
        expect(toLocalizedText("Share and earn!")).toEqual({
            default: "Share and earn!",
            en: "",
            fr: "",
        });
    });

    it("loads a tiered map tier-for-tier", () => {
        expect(toLocalizedText({ en: "Hi", fr: "Salut" })).toEqual({
            default: "",
            en: "Hi",
            fr: "Salut",
        });
    });

    it("keeps the default tier alongside language overrides", () => {
        expect(toLocalizedText({ default: "Yo", en: "Hi" })).toEqual({
            default: "Yo",
            en: "Hi",
            fr: "",
        });
    });
});

describe("fromLocalizedText", () => {
    it("clears the field when every tier is empty", () => {
        expect(
            fromLocalizedText({ default: "", en: "", fr: "" })
        ).toBeUndefined();
    });

    it("treats whitespace-only tiers as empty", () => {
        expect(
            fromLocalizedText({ default: "  ", en: "\t", fr: " " })
        ).toBeUndefined();
    });

    it("collapses a default-only value to a bare string", () => {
        expect(fromLocalizedText({ default: "Hello", en: "", fr: "" })).toBe(
            "Hello"
        );
    });

    it("keeps a tiered map when languages are set", () => {
        expect(
            fromLocalizedText({ default: "", en: "Hi", fr: "Salut" })
        ).toEqual({ en: "Hi", fr: "Salut" });
    });

    it("preserves the default tier in a tiered map", () => {
        expect(
            fromLocalizedText({ default: "Yo", en: "Hi", fr: "" })
        ).toEqual({ default: "Yo", en: "Hi" });
    });

    it("emits a partial map for a single language override", () => {
        expect(fromLocalizedText({ default: "", en: "Hi", fr: "" })).toEqual({
            en: "Hi",
        });
    });

    it("trims surrounding whitespace before storing", () => {
        expect(
            fromLocalizedText({ default: "  Hello  ", en: "", fr: "" })
        ).toBe("Hello");
    });
});

describe("localizable round-trip", () => {
    const cases: Array<{ name: string; value: LocalizableString | undefined }> =
        [
            { name: "unset", value: undefined },
            { name: "bare string (default tier)", value: "Share and earn!" },
            { name: "per-language map", value: { en: "Hi", fr: "Salut" } },
            { name: "default + language override", value: { default: "Yo", en: "Hi" } },
            { name: "single language", value: { fr: "Salut" } },
        ];

    for (const { name, value } of cases) {
        it(`is stable for ${name}`, () => {
            const roundTripped = fromLocalizedText(
                toLocalizedText(value)
            ) as LocalizableString | undefined;
            expect(roundTripped).toEqual(value);
        });
    }
});
