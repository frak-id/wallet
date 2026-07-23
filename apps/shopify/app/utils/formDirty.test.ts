import { describe, expect, it } from "vitest";
import {
    type ExplorerFormState,
    isCustomizationsFormDirty,
    isExplorerFormDirty,
    validateExplorerSave,
} from "./formDirty";

function makeState(
    overrides: Partial<ExplorerFormState> = {}
): ExplorerFormState {
    return {
        enabled: false,
        logoUrl: "https://example.com/logo.png",
        heroImageUrl: "https://example.com/hero.png",
        heroImageUrls: ["https://example.com/hero-1.png"],
        description: "A shop description.",
        ...overrides,
    };
}

describe("isExplorerFormDirty", () => {
    it("returns false when pending matches defaults exactly", () => {
        const defaults = makeState();
        expect(isExplorerFormDirty(makeState(), defaults)).toBe(false);
    });

    it("returns true when the switch changed", () => {
        const defaults = makeState();
        expect(
            isExplorerFormDirty(makeState({ enabled: true }), defaults)
        ).toBe(true);
    });

    it("returns true when the logo URL changed", () => {
        const defaults = makeState();
        expect(
            isExplorerFormDirty(
                makeState({ logoUrl: "https://example.com/new-logo.png" }),
                defaults
            )
        ).toBe(true);
    });

    it("returns true when the hero URL changed", () => {
        const defaults = makeState();
        expect(
            isExplorerFormDirty(
                makeState({ heroImageUrl: "https://example.com/new-hero.png" }),
                defaults
            )
        ).toBe(true);
    });

    it("returns true when the hero extras list changed", () => {
        const defaults = makeState();
        expect(
            isExplorerFormDirty(
                makeState({
                    heroImageUrls: [
                        "https://example.com/hero-1.png",
                        "https://example.com/hero-2.png",
                    ],
                }),
                defaults
            )
        ).toBe(true);
    });

    it("returns true when the description changed", () => {
        const defaults = makeState();
        expect(
            isExplorerFormDirty(
                makeState({ description: "Updated description." }),
                defaults
            )
        ).toBe(true);
    });

    it("returns false after reverting a field back to its default", () => {
        const defaults = makeState();
        const reverted = makeState({ description: "Updated" });
        reverted.description = defaults.description;
        expect(isExplorerFormDirty(reverted, defaults)).toBe(false);
    });
});

describe("isCustomizationsFormDirty", () => {
    it("returns false when the logo URL matches the default", () => {
        expect(
            isCustomizationsFormDirty(
                "https://example.com/logo.png",
                "https://example.com/logo.png"
            )
        ).toBe(false);
    });

    it("returns true when the logo URL changed", () => {
        expect(
            isCustomizationsFormDirty(
                "https://example.com/new-logo.png",
                "https://example.com/logo.png"
            )
        ).toBe(true);
    });

    it("returns false after reverting to the default", () => {
        const original = "https://example.com/logo.png";
        const reverted = original;
        expect(isCustomizationsFormDirty(reverted, original)).toBe(false);
    });
});

describe("validateExplorerSave", () => {
    it("allows saving when both URLs are valid", () => {
        const state = makeState();
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(true);
        if (result.canSave) {
            expect(result.settingsToSave).toEqual(state);
        }
    });

    it("allows saving an empty logo/hero URL", () => {
        const state = makeState({ logoUrl: "", heroImageUrl: "" });
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(true);
    });

    it("blocks saving an invalid logo URL while the listing is enabled", () => {
        const state = makeState({ enabled: true, logoUrl: "not a url" });
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(false);
        if (!result.canSave) {
            expect(result.logoError).toBe(true);
            expect(result.heroError).toBe(false);
        }
    });

    it("blocks saving an invalid hero URL while the listing is enabled", () => {
        const state = makeState({
            enabled: true,
            heroImageUrl: "ftp://example.com/hero.png",
        });
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(false);
        if (!result.canSave) {
            expect(result.logoError).toBe(false);
            expect(result.heroError).toBe(true);
        }
    });

    it("drops an invalid logo URL and allows saving when the listing is disabled", () => {
        const state = makeState({ enabled: false, logoUrl: "not a url" });
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(true);
        if (result.canSave) {
            expect(result.settingsToSave.logoUrl).toBe("");
            expect(result.settingsToSave.heroImageUrl).toBe(state.heroImageUrl);
        }
    });

    it("drops both invalid URLs and allows saving when the listing is disabled", () => {
        const state = makeState({
            enabled: false,
            logoUrl: "not a url",
            heroImageUrl: "ftp://example.com/hero.png",
        });
        const result = validateExplorerSave(state);
        expect(result.canSave).toBe(true);
        if (result.canSave) {
            expect(result.settingsToSave.logoUrl).toBe("");
            expect(result.settingsToSave.heroImageUrl).toBe("");
        }
    });
});
