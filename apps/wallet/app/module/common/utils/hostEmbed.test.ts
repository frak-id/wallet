import { describe, expect, it } from "vitest";
import { decodeHostEmbed, EMBED_NATIVE, isHostEmbedded } from "./hostEmbed";

describe("decodeHostEmbed", () => {
    it("accepts the one value the contract defines", () => {
        expect(decodeHostEmbed("native")).toBe(EMBED_NATIVE);
    });

    it("rejects near misses rather than guessing at them", () => {
        expect(decodeHostEmbed("NATIVE")).toBeUndefined();
        expect(decodeHostEmbed("native ")).toBeUndefined();
        expect(decodeHostEmbed("iframe")).toBeUndefined();
        expect(decodeHostEmbed("")).toBeUndefined();
        expect(decodeHostEmbed(undefined)).toBeUndefined();
        expect(decodeHostEmbed(null)).toBeUndefined();
    });

    it("rejects the JSON-parsed shapes a router can hand it", () => {
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
        expect(isHostEmbedded("frak-com.acme.app")).toBe(false);
    });
});
