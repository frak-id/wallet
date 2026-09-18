import { describe, expect, it } from "vitest";
import {
    jsDelivrUrl,
    parseStage,
    singleDistributionId,
    validateShim,
} from "./flip-sdk-pointer";

describe("parseStage", () => {
    it("accepts --stage prod", () => {
        expect(parseStage(["--stage", "prod"])).toBe("prod");
    });

    it("accepts --stage dev", () => {
        expect(parseStage(["--stage", "dev"])).toBe("dev");
    });

    it("rejects a missing --stage", () => {
        expect(() => parseStage([])).toThrow(/--stage must be/);
    });

    it("rejects an unknown stage value", () => {
        expect(() => parseStage(["--stage", "staging"])).toThrow(
            /--stage must be/
        );
    });
});

describe("validateShim", () => {
    it("accepts a shim pinned to the exact version", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.2/cdn/loader.js");',
                "1.2.2"
            )
        ).toEqual([]);
    });

    it("flags a shim missing the exact version pin", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.1/cdn/loader.js");',
                "1.2.2"
            )
        ).toEqual(["shim does not pin @1.2.2/cdn/loader.js"]);
    });

    it("flags a floating @latest tag", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/loader.js");',
                "1.2.2"
            )
        ).toEqual([
            "shim does not pin @1.2.2/cdn/loader.js",
            'shim still contains "@latest"',
        ]);
    });

    it("flags a floating @beta tag", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@beta/cdn/loader.js");',
                "1.2.2"
            )
        ).toEqual([
            "shim does not pin @1.2.2/cdn/loader.js",
            'shim still contains "@beta"',
        ]);
    });

    it("accepts a beta shim pinned to its prerelease version", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.2-beta.f0ed3664/cdn/loader.js");',
                "1.2.2-beta.f0ed3664"
            )
        ).toEqual([]);
    });

    it("flags a cache-busting query string", () => {
        expect(
            validateShim(
                'import("https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.2/cdn/loader.js?v=1");',
                "1.2.2"
            )
        ).toEqual(['shim still contains "?v="']);
    });
});

describe("singleDistributionId", () => {
    it("returns the only id", () => {
        expect(singleDistributionId(["E123"], "sdk.frak.id")).toBe("E123");
    });

    it("rejects no match", () => {
        expect(() => singleDistributionId([], "sdk.frak.id")).toThrow(
            /found 0/
        );
    });

    it("rejects an ambiguous alias", () => {
        expect(() => singleDistributionId(["E1", "E2"], "sdk.frak.id")).toThrow(
            /found 2 \(E1, E2\)/
        );
    });
});

describe("jsDelivrUrl", () => {
    it("builds the exact-version loader URL", () => {
        expect(jsDelivrUrl("1.2.2")).toBe(
            "https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.2/cdn/loader.js"
        );
    });
});
