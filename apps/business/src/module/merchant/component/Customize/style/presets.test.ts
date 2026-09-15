import { describe, expect, it } from "vitest";
import {
    applyLook,
    buildLook,
    DEFAULT_ACCENT,
    LOOKS,
    matchLook,
    readableOn,
    SIZE_STEPS,
} from "./presets";
import { serializeStyleCss, TRANSPARENT } from "./styleCodec";

describe("readableOn", () => {
    it("puts white on a dark accent", () => {
        expect(readableOn("#1e1e1e")).toBe("#ffffff");
    });

    it("puts near-black on a light accent", () => {
        expect(readableOn("#f2f2f2")).toBe("#111111");
    });

    it("expands a three-digit accent before measuring it", () => {
        expect(readableOn("#fff")).toBe("#111111");
    });

    it("ignores the alpha channel of an eight-digit accent", () => {
        expect(readableOn("#ffffff20")).toBe("#111111");
    });

    it("falls back to white on an unparsable accent", () => {
        expect(readableOn("rebeccapurple")).toBe("#ffffff");
    });

    it("picks dark text on the mid-tones a luminance threshold got wrong", () => {
        expect(readableOn("#808080")).toBe("#111111");
        expect(readableOn("#3b82f6")).toBe("#111111");
    });

    it("never picks the lower-contrast of the two candidates", () => {
        const channel = (raw: number) =>
            raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
        const luminance = (hex: string) =>
            0.2126 * channel(Number.parseInt(hex.slice(1, 3), 16) / 255) +
            0.7152 * channel(Number.parseInt(hex.slice(3, 5), 16) / 255) +
            0.0722 * channel(Number.parseInt(hex.slice(5, 7), 16) / 255);
        const ratio = (a: number, b: number) =>
            a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05);

        for (let step = 0; step <= 255; step += 15) {
            const hex = `#${step.toString(16).padStart(2, "0").repeat(3)}`;
            const background = luminance(hex);
            const chosen = luminance(readableOn(hex));
            const rejected = luminance(
                readableOn(hex) === "#ffffff" ? "#111111" : "#ffffff"
            );
            expect(ratio(background, chosen)).toBeGreaterThanOrEqual(
                ratio(background, rejected)
            );
        }
    });
});

describe("buildLook", () => {
    it("emits nothing for the theme look", () => {
        expect(buildLook("theme", "m", DEFAULT_ACCENT)).toEqual({});
    });

    it("keeps the solid look free of a border", () => {
        expect(buildLook("solid", "m", "#3366cc")).toMatchObject({
            bg: "#3366cc",
            bw: 0,
        });
    });

    it("gives the outline look a transparent fill and an accent border", () => {
        expect(buildLook("outline", "m", "#3366cc")).toMatchObject({
            bg: TRANSPARENT,
            bc: "#3366cc",
            bw: 1,
        });
    });

    it("scales padding and text together", () => {
        const small = buildLook("solid", "s", DEFAULT_ACCENT);
        const large = buildLook("solid", "l", DEFAULT_ACCENT);

        expect(large.fs).toBeGreaterThan(small.fs ?? 0);
        expect(large.px).toBeGreaterThan(small.px ?? 0);
    });

    it("produces values the codec accepts for every look and size", () => {
        for (const look of LOOKS) {
            if (look === "theme") continue;
            for (const size of SIZE_STEPS) {
                const css = serializeStyleCss(
                    buildLook(look, size, "#3366cc"),
                    "",
                    "product"
                );
                expect(css).toContain("!important");
            }
        }
    });
});

describe("matchLook", () => {
    it("reads empty values as the theme look", () => {
        expect(matchLook({})).toMatchObject({ look: "theme" });
    });

    it("round-trips every look and size", () => {
        for (const look of LOOKS) {
            if (look === "theme") continue;
            for (const size of SIZE_STEPS) {
                const match = matchLook(buildLook(look, size, "#3366cc"));
                expect(match).toMatchObject({ look, size, accent: "#3366cc" });
            }
        }
    });

    it("stays on the preset when only spacing was nudged", () => {
        const values = {
            ...buildLook("solid", "m", "#3366cc"),
            px: 33,
            mt: 12,
        };
        expect(matchLook(values).look).toBe("solid");
    });

    it("drops to custom once a colour no longer matches the preset", () => {
        const values = { ...buildLook("solid", "m", "#3366cc"), bc: "#abcdef" };
        expect(matchLook(values).look).toBe("custom");
    });

    it("reports a hand-set text size as a custom size", () => {
        const values = { ...buildLook("solid", "m", "#3366cc"), fs: 22 };
        expect(matchLook(values).size).toBe("custom");
    });

    it("treats a cleared colour the same as an absent one", () => {
        expect(matchLook({ bg: "", fg: "", bc: "", bw: undefined }).look).toBe(
            "theme"
        );
    });
});

describe("applyLook", () => {
    it("carries the margins across a look change", () => {
        const before = { mt: 16, mb: 8, ml: 0, mr: 4 };
        const after = applyLook(before, "outline", "m", "#3366cc");

        expect(after).toMatchObject(before);
        expect(after.bw).toBe(1);
    });

    it("clears the previous look's leftovers", () => {
        const outline = buildLook("outline", "m", "#3366cc");
        const solid = applyLook(outline, "solid", "m", "#3366cc");

        expect(solid.bc).toBeUndefined();
    });
});
