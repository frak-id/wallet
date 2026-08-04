/**
 * Tests for generateSsoUrl / ssoParamsToCompressed
 */

import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { decompressJsonFromB64 } from "../compression/decompress";
import type { CompressedSsoData } from "./sso";
import { generateSsoUrl } from "./sso";

function decodeUrl(url: string): CompressedSsoData {
    const p = new URL(url).searchParams.get("p");
    if (!p) throw new Error("missing p param");
    const decoded = decompressJsonFromB64<CompressedSsoData>(p);
    if (!decoded) throw new Error("failed to decompress");
    return decoded;
}

describe("generateSsoUrl", () => {
    it("does not include pf when no proof is provided", () => {
        const url = generateSsoUrl(
            "https://wallet.frak.id",
            { directExit: true },
            "0x123",
            "My App",
            "client-1"
        );

        const decoded = decodeUrl(url);
        expect(decoded.cId).toBe("client-1");
        expect(decoded.pf).toBeUndefined();
    });

    it("includes pf when a proof is provided", () => {
        const url = generateSsoUrl(
            "https://wallet.frak.id",
            { directExit: true },
            "0x123",
            "My App",
            "client-1",
            undefined,
            "the-proof-string"
        );

        const decoded = decodeUrl(url);
        expect(decoded.cId).toBe("client-1");
        expect(decoded.pf).toBe("the-proof-string");
    });

    it("preserves pf alongside css in the compressed round-trip", () => {
        const url = generateSsoUrl(
            "https://wallet.frak.id",
            { directExit: true },
            "0x123",
            "My App",
            "client-1",
            "body { color: red; }",
            "the-proof-string"
        );

        const decoded = decodeUrl(url);
        expect(decoded.md.css).toBe("body { color: red; }");
        expect(decoded.pf).toBe("the-proof-string");
    });
});
