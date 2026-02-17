import { describe, expect, it } from "vitest";
import {
    detectAppBlockSupport,
    detectFrakActivated,
    detectFrakButton,
    detectWalletButton,
    extractThemeId,
    type ThemeBlockInfo,
} from "./theme";

/**
 * Tests for theme block detection logic from theme.ts.
 *
 * The service functions depend on GraphQL for fetching theme files,
 * but the core logic of parsing JSON templates and detecting blocks
 * is testable in isolation.
 */

/* ------------------------------------------------------------------ */
/*  Theme ID extraction                                                */
/* ------------------------------------------------------------------ */

describe("extractThemeId", () => {
    it("extracts numeric ID from full gid", () => {
        expect(
            extractThemeId("gid://shopify/OnlineStoreTheme/140895584433")
        ).toBe("140895584433");
    });

    it("extracts from shorter gid", () => {
        expect(extractThemeId("gid://shopify/OnlineStoreTheme/123")).toBe(
            "123"
        );
    });

    it("returns empty for non-matching input", () => {
        expect(extractThemeId("no-digits-here")).toBe("");
    });
});

/* ------------------------------------------------------------------ */
/*  Frak activation detection (settings_data.json parsing)             */
/* ------------------------------------------------------------------ */

describe("detectFrakActivated", () => {
    it("returns true when listener block is present and enabled", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            abc123: {
                type: "shopify://apps/frak/blocks/listener/abcdef",
                disabled: false,
            },
        };
        expect(detectFrakActivated(blocks)).toBe(true);
    });

    it("returns false when listener block is disabled", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            abc123: {
                type: "shopify://apps/frak/blocks/listener/abcdef",
                disabled: true,
            },
        };
        expect(detectFrakActivated(blocks)).toBe(false);
    });

    it("returns false when no listener block exists", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            abc123: {
                type: "shopify://apps/other/blocks/something/xyz",
            },
        };
        expect(detectFrakActivated(blocks)).toBe(false);
    });

    it("returns false when blocks is undefined", () => {
        expect(detectFrakActivated(undefined)).toBe(false);
    });

    it("returns false when blocks is empty", () => {
        expect(detectFrakActivated({})).toBe(false);
    });

    it("finds listener among multiple blocks", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            block1: { type: "shopify://apps/other/blocks/foo/1" },
            block2: {
                type: "shopify://apps/frak/blocks/listener/abc",
                disabled: false,
            },
            block3: { type: "shopify://apps/another/blocks/bar/2" },
        };
        expect(detectFrakActivated(blocks)).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/*  Frak button detection (product.json main section parsing)          */
/* ------------------------------------------------------------------ */

describe("detectFrakButton", () => {
    it("returns true when main section has referral_button in block_order", () => {
        const sections = {
            main: {
                type: "main-product",
                block_order: ["title", "frak_referral_button_abc123", "price"],
            },
        };
        expect(detectFrakButton(sections)).toBe(true);
    });

    it("returns false when no referral_button in block_order", () => {
        const sections = {
            main: {
                type: "main-product",
                block_order: ["title", "price", "description"],
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });

    it("returns false when main section has no block_order", () => {
        const sections = {
            main: {
                type: "main-product",
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });

    it("detects main section by type prefix main-", () => {
        const sections = {
            "custom-id": {
                type: "main-product-custom",
                block_order: ["referral_button_xyz"],
            },
        };
        expect(detectFrakButton(sections)).toBe(true);
    });

    it("returns false for empty sections", () => {
        expect(detectFrakButton({})).toBe(false);
    });

    it("ignores string sections", () => {
        const sections = {
            main: "some-string-value" as unknown as {
                type: string;
                block_order?: string[];
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/*  Wallet button detection (settings_data.json parsing)               */
/* ------------------------------------------------------------------ */

describe("detectWalletButton", () => {
    it("returns block ID when wallet_button is present and enabled", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            xyz789: {
                type: "shopify://apps/frak/blocks/wallet_button/abc123",
            },
        };
        expect(detectWalletButton(blocks)).toBe("abc123");
    });

    it("returns null when wallet_button is disabled", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            xyz789: {
                type: "shopify://apps/frak/blocks/wallet_button/abc123",
                disabled: true,
            },
        };
        expect(detectWalletButton(blocks)).toBeNull();
    });

    it("returns null when no wallet_button exists", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            xyz789: {
                type: "shopify://apps/frak/blocks/listener/abc123",
            },
        };
        expect(detectWalletButton(blocks)).toBeNull();
    });

    it("returns null when blocks is undefined", () => {
        expect(detectWalletButton(undefined)).toBeNull();
    });

    it("returns null when blocks is empty", () => {
        expect(detectWalletButton({})).toBeNull();
    });

    it("extracts ID with complex suffix", () => {
        const blocks: Record<string, ThemeBlockInfo> = {
            block1: {
                type: "shopify://apps/frak/blocks/wallet_button/def456-xyz",
            },
        };
        expect(detectWalletButton(blocks)).toBe("def456-xyz");
    });
});

/* ------------------------------------------------------------------ */
/*  Schema block parsing (Liquid schema detection)                     */
/* ------------------------------------------------------------------ */

describe("detectAppBlockSupport", () => {
    it("returns true when schema has @app block type", () => {
        const liquid = `
            {% schema %}
            {
                "name": "Main product",
                "blocks": [
                    { "type": "text" },
                    { "type": "@app" }
                ]
            }
            {% endschema %}
        `;
        expect(detectAppBlockSupport(liquid)).toBe(true);
    });

    it("returns false when schema has no @app block type", () => {
        const liquid = `
            {% schema %}
            {
                "name": "Main product",
                "blocks": [
                    { "type": "text" },
                    { "type": "image" }
                ]
            }
            {% endschema %}
        `;
        expect(detectAppBlockSupport(liquid)).toBe(false);
    });

    it("returns false when no schema tag exists", () => {
        expect(detectAppBlockSupport("<div>Hello</div>")).toBe(false);
    });

    it("returns false when schema has no blocks", () => {
        const liquid = `
            {% schema %}
            { "name": "Simple section" }
            {% endschema %}
        `;
        expect(detectAppBlockSupport(liquid)).toBe(false);
    });

    it("returns false for invalid JSON in schema", () => {
        const liquid = `
            {% schema %}
            not valid json
            {% endschema %}
        `;
        expect(detectAppBlockSupport(liquid)).toBe(false);
    });
});
