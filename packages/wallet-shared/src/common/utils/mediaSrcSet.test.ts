import { describe, expect, it } from "vitest";
import { mediaSrcSet } from "./mediaSrcSet";

const cdnUrl = "https://cdn.gcp.frak.id/images-dev/0xabc/logo.webp";

describe("mediaSrcSet", () => {
    it("derives sm/md variants for a Frak-hosted webp (small mode)", () => {
        expect(mediaSrcSet(cdnUrl)).toEqual({
            src: cdnUrl,
            srcSet:
                "https://cdn.gcp.frak.id/images-dev/0xabc/logo-sm.webp 1x, " +
                "https://cdn.gcp.frak.id/images-dev/0xabc/logo-md.webp 2x, " +
                `${cdnUrl} 3x`,
        });
    });

    it("derives md variant for large mode", () => {
        expect(mediaSrcSet(cdnUrl, "large")).toEqual({
            src: cdnUrl,
            srcSet: `https://cdn.gcp.frak.id/images-dev/0xabc/logo-md.webp 1x, ${cdnUrl} 2x`,
        });
    });

    it("preserves query strings in variant URLs", () => {
        const url = `${cdnUrl}?v=2`;
        const result = mediaSrcSet(url, "large");
        expect(result.srcSet).toBe(
            `https://cdn.gcp.frak.id/images-dev/0xabc/logo-md.webp?v=2 1x, ${url} 2x`
        );
    });

    it("derives sm/md variants for a hero image", () => {
        const url = "https://cdn.gcp.frak.id/images-dev/0xabc/hero.webp";
        expect(mediaSrcSet(url)).toEqual({
            src: url,
            srcSet:
                "https://cdn.gcp.frak.id/images-dev/0xabc/hero-sm.webp 1x, " +
                "https://cdn.gcp.frak.id/images-dev/0xabc/hero-md.webp 2x, " +
                `${url} 3x`,
        });
    });

    it("derives variants for hash-suffixed carousel heroes", () => {
        const url =
            "https://cdn.gcp.frak.id/images-dev/0xabc/hero-a1b2c3d4.webp";
        expect(mediaSrcSet(url).srcSet).toBe(
            "https://cdn.gcp.frak.id/images-dev/0xabc/hero-a1b2c3d4-sm.webp 1x, " +
                "https://cdn.gcp.frak.id/images-dev/0xabc/hero-a1b2c3d4-md.webp 2x, " +
                `${url} 3x`
        );
    });

    it("skips srcSet for non-webp Frak URLs (e.g. SVG)", () => {
        const url = "https://cdn.gcp.frak.id/images-dev/0xabc/logo.svg";
        expect(mediaSrcSet(url)).toEqual({ src: url });
    });

    it("skips srcSet for external merchant URLs", () => {
        const url = "https://example.com/assets/logo.webp";
        expect(mediaSrcSet(url)).toEqual({ src: url });
    });

    it("is not fooled by 'frak' appearing outside the hostname", () => {
        const url = "https://evil.com/cdn.gcp.frak.id/frak.webp";
        expect(mediaSrcSet(url)).toEqual({ src: url });
    });

    it("skips srcSet for relative or malformed URLs", () => {
        expect(mediaSrcSet("/local/logo.webp")).toEqual({
            src: "/local/logo.webp",
        });
        expect(mediaSrcSet("not a url.webp")).toEqual({
            src: "not a url.webp",
        });
    });
});
