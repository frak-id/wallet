import { describe, expect, it } from "vitest";
import {
    detectAppBlockSupport,
    detectFrakActivated,
    detectFrakBannerInSections,
    detectFrakButton,
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
    it("returns true when a section contains a referral_button block", () => {
        const sections = {
            main: {
                type: "main-product",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/referral_button/abc",
                        disabled: false,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakButton(sections)).toBe(true);
    });

    it("returns true when a section contains a banner block", () => {
        const sections = {
            main: {
                type: "main-product",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/banner/xyz",
                        disabled: false,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakButton(sections)).toBe(true);
    });

    it("detects Frak blocks in a non-main section (e.g. header)", () => {
        const sections = {
            header: {
                type: "header",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/referral_button/abc",
                        disabled: false,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakButton(sections)).toBe(true);
    });

    it("returns false when no Frak block is present in any section", () => {
        const sections = {
            main: {
                type: "main-product",
                blocks: {
                    abc123: {
                        type: "shopify://apps/other/blocks/foo/bar",
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });

    it("returns false when the Frak block is disabled", () => {
        const sections = {
            main: {
                type: "main-product",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/referral_button/abc",
                        disabled: true,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });

    it("returns false when sections have no blocks property", () => {
        const sections = {
            main: {
                type: "main-product",
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });

    it("returns false for empty sections", () => {
        expect(detectFrakButton({})).toBe(false);
    });

    it("ignores string sections", () => {
        const sections = {
            main: "some-string-value" as unknown as {
                type: string;
                block_order?: string[];
                blocks?: Record<string, ThemeBlockInfo>;
            },
        };
        expect(detectFrakButton(sections)).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/*  Frak banner detection in settings_data sections                    */
/* ------------------------------------------------------------------ */

describe("detectFrakBannerInSections", () => {
    it("returns true when a section has a banner block enabled", () => {
        const sections = {
            header: {
                type: "header",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/banner/abcdef",
                        disabled: false,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(true);
    });

    it("returns false when banner block is disabled", () => {
        const sections = {
            header: {
                type: "header",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/banner/abcdef",
                        disabled: true,
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(false);
    });

    it("returns false when no banner block exists in any section", () => {
        const sections = {
            header: {
                type: "header",
                blocks: {
                    abc123: {
                        type: "shopify://apps/frak/blocks/listener/xyz",
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(false);
    });

    it("returns false when sections is undefined", () => {
        expect(detectFrakBannerInSections(undefined)).toBe(false);
    });

    it("returns false when sections is empty", () => {
        expect(detectFrakBannerInSections({})).toBe(false);
    });

    it("finds banner among multiple sections and blocks", () => {
        const sections = {
            header: {
                type: "header",
                blocks: {
                    block1: {
                        type: "shopify://apps/frak/blocks/listener/1",
                    },
                } as Record<string, ThemeBlockInfo>,
            },
            footer: {
                type: "footer",
                blocks: {
                    block2: {
                        type: "shopify://apps/frak/blocks/banner/abc",
                        disabled: false,
                    },
                    block3: {
                        type: "shopify://apps/other/blocks/bar/2",
                    },
                } as Record<string, ThemeBlockInfo>,
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(true);
    });

    it("ignores string sections", () => {
        const sections = {
            header: "some-string-value" as unknown as {
                type: string;
                blocks?: Record<string, ThemeBlockInfo>;
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(false);
    });

    it("returns false when sections have no blocks property", () => {
        const sections = {
            header: {
                type: "header",
            },
        };
        expect(detectFrakBannerInSections(sections)).toBe(false);
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
