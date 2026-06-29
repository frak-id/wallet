import { describe, expect, it } from "vitest";
import { buildFrakSnippet } from "./buildFrakSnippet";

const BASE = {
    merchantId: "abc-123",
    walletUrl: "https://wallet.frak.id",
    componentsUrl: "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest",
};

describe("buildFrakSnippet", () => {
    it("includes the components script tag", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain(
            `<script src="${BASE.componentsUrl}" defer="defer"></script>`
        );
    });

    it("bakes the merchantId into the config", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain(`merchantId: "${BASE.merchantId}"`);
    });

    it("bakes the walletUrl into the config", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain(`walletUrl: "${BASE.walletUrl}"`);
    });

    it("escapes quotes and `<` so a value can't break out of the <script>", () => {
        const snippet = buildFrakSnippet({
            ...BASE,
            merchantId: 'x"</script>',
        });
        // `<` is escaped to \u003c, so the value can't inject a closing tag,
        // and the embedded quote is escaped so it can't end the string early.
        expect(snippet).toContain("\\u003c/script>");
        expect(snippet).not.toContain('"x"</script>');
    });

    it("does NOT set waitForBackendConfig: false (must default to true for dashboard-driven config)", () => {
        // The snippet may mention waitForBackendConfig in a comment, but must
        // never explicitly set it to false (which would bypass backend config).
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).not.toContain("waitForBackendConfig: false");
    });

    it("includes syncFrakCartAttributes function", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain("syncFrakCartAttributes");
        expect(snippet).toContain("frak-client-id");
    });

    it("includes sessionStorage merchantId store for checkout pixel fallback", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain("sessionStorage.setItem");
        expect(snippet).toContain("frak-merchant-id");
    });

    it("sets up window.FrakSetup", () => {
        const snippet = buildFrakSnippet(BASE);
        expect(snippet).toContain("window.FrakSetup");
    });

    it("does NOT contain any Liquid template syntax", () => {
        const snippet = buildFrakSnippet(BASE);
        // No {{ metafield }} reads — this is the whole point of the legacy snippet
        expect(snippet).not.toContain("{{");
        expect(snippet).not.toContain("}}");
        expect(snippet).not.toContain("{%");
    });

    it("generates a different snippet for different merchantIds", () => {
        const a = buildFrakSnippet({ ...BASE, merchantId: "merchant-a" });
        const b = buildFrakSnippet({ ...BASE, merchantId: "merchant-b" });
        expect(a).not.toBe(b);
        expect(a).toContain('"merchant-a"');
        expect(b).toContain('"merchant-b"');
    });
});
