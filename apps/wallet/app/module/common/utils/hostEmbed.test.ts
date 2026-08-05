import { describe, expect, it } from "vitest";
import { decodeHostEmbed, EMBED_NATIVE, isHostEmbedded } from "./hostEmbed";

/**
 * This module exists to stop `/sharing` and `/install` answering "is a native
 * host drawing the chrome?" differently, which they did: `/sharing` read an
 * `embed` param, `/install` inferred a host from the presence of
 * `returnScheme`. The point of the tests below is that there is exactly one
 * answer, and that it does not come from anywhere else.
 */
describe("decodeHostEmbed", () => {
    it("accepts the one value the contract defines", () => {
        expect(decodeHostEmbed("native")).toBe(EMBED_NATIVE);
    });

    it("rejects near misses rather than guessing at them", () => {
        // A closed set: a host on a future platform gets its own value, and an
        // unknown one must read as a plain web visit rather than as `native`.
        expect(decodeHostEmbed("NATIVE")).toBeUndefined();
        expect(decodeHostEmbed("native ")).toBeUndefined();
        expect(decodeHostEmbed("iframe")).toBeUndefined();
        expect(decodeHostEmbed("")).toBeUndefined();
        expect(decodeHostEmbed(undefined)).toBeUndefined();
        expect(decodeHostEmbed(null)).toBeUndefined();
    });

    it("rejects the JSON-parsed shapes a router can hand it", () => {
        // The wallet's router runs search values through `JSON.parse`, so a
        // truthy-looking `?embed=1` arrives as a number, not a string.
        expect(decodeHostEmbed(1)).toBeUndefined();
        expect(decodeHostEmbed(true)).toBeUndefined();
        expect(decodeHostEmbed(["native"])).toBeUndefined();
        expect(decodeHostEmbed({ embed: "native" })).toBeUndefined();
    });
});

describe("isHostEmbedded", () => {
    it("is what both routes compute their chrome from", () => {
        expect(isHostEmbedded("native")).toBe(true);
        expect(isHostEmbedded(undefined)).toBe(false);
        expect(isHostEmbedded("iframe")).toBe(false);
    });

    it("is not satisfied by a return scheme", () => {
        // The regression this module was extracted to prevent. A host that
        // wants callbacks and a host that draws chrome are separate claims, and
        // `/install` conflating them is what made the sheet render one page
        // host-embedded and the next one not, one navigation apart.
        expect(isHostEmbedded("frak-com.acme.app")).toBe(false);
    });
});
