import { parseSearchWith } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { Route } from "./sharing";

// `validateSearch` is the whole native-facing param contract, and a shipped
// SDK binary can never be updated to match a change here.
const validateSearch = Route.options.validateSearch as (
    search: Record<string, unknown>
) => Record<string, unknown>;

// A host writes a URL string, not an object. Going through the router's own
// parser is the only way to see the types `validateSearch` is really handed:
// it runs values through JSON, so `?native=1` arrives as a number.
const parseSearch = parseSearchWith(JSON.parse);
const fromUrl = (query: string) =>
    validateSearch(parseSearch(query) as Record<string, unknown>);

const beforeLoad = Route.options.beforeLoad as (ctx: {
    search: Record<string, unknown>;
}) => void;

describe("/sharing native clientId guard", () => {
    it("rejects a native launch with no clientId", () => {
        expect(() => beforeLoad({ search: { native: true } })).toThrow(
            /clientId/
        );
    });

    it("allows a native launch that states its clientId", () => {
        expect(() =>
            beforeLoad({ search: { native: true, clientId: "c1" } })
        ).not.toThrow();
    });

    it("leaves web callers alone, since they may resolve one later", () => {
        expect(() => beforeLoad({ search: {} })).not.toThrow();
        expect(() =>
            beforeLoad({ search: { checkoutToken: "tok" } })
        ).not.toThrow();
    });
});

describe("/sharing param contract", () => {
    it("ignores params it does not know", () => {
        const result = validateSearch({
            merchantId: "m1",
            somethingFromAFutureSdk: "value",
        });

        expect(result.merchantId).toBe("m1");
        expect(result).not.toHaveProperty("somethingFromAFutureSdk");
    });

    it("accepts sdkv so old binaries stay identifiable", () => {
        expect(validateSearch({ sdkv: "0.1.0" }).sdkv).toBe("0.1.0");
        expect(validateSearch({}).sdkv).toBeUndefined();
    });

    it("reads native and confirmed as either flag form", () => {
        expect(validateSearch({ native: 1 }).native).toBe(true);
        expect(validateSearch({ native: "1" }).native).toBe(true);
        expect(validateSearch({ native: true }).native).toBe(true);
        expect(validateSearch({ native: "true" }).native).toBe(true);
        expect(validateSearch({ native: 0 }).native).toBe(false);
        expect(validateSearch({ native: "0" }).native).toBe(false);
        expect(validateSearch({}).native).toBe(false);

        expect(validateSearch({ confirmed: 1 }).confirmed).toBe(true);
        expect(validateSearch({ confirmed: "1" }).confirmed).toBe(true);
        expect(validateSearch({}).confirmed).toBe(false);
    });

    it("drops a returnScheme that is not a valid frak scheme", () => {
        expect(validateSearch({ returnScheme: "frak-acme" }).returnScheme).toBe(
            "frak-acme"
        );
        expect(
            validateSearch({ returnScheme: "some-banking-app" }).returnScheme
        ).toBeUndefined();
    });

    it("drops a redirectUrl that is not https", () => {
        expect(
            validateSearch({ redirectUrl: "https://shop.example/cart" })
                .redirectUrl
        ).toBe("https://shop.example/cart");
        expect(
            validateSearch({ redirectUrl: "javascript:alert(1)" }).redirectUrl
        ).toBeUndefined();
    });

    it("accepts a seeded reward headline but not arbitrary text", () => {
        expect(validateSearch({ r: "12,50 €" }).r).toBe("12,50 €");
        expect(validateSearch({ r: "<img src=x>" }).r).toBeUndefined();
        expect(validateSearch({}).r).toBeUndefined();
    });

    it("keeps a null attribution distinct from an absent one", () => {
        // null disables backend attribution defaults; undefined still applies
        // them, so the two must not collapse into each other.
        expect(validateSearch({ attribution: null }).attribution).toBeNull();
        expect(validateSearch({}).attribution).toBeUndefined();
    });
});

// The contract a host actually writes: a URL. Asserting against hand-built
// objects hid that the router hands `?native=1` over as a number, which read
// as false and rewrote the URL to `native=false` with the page in full chrome.
describe("/sharing params as a host writes them", () => {
    it("reads a native launch from a plain URL", () => {
        const search = fromUrl(
            "?native=1&confirmed=1&clientId=test&merchantId=m1"
        );

        expect(search.native).toBe(true);
        expect(search.confirmed).toBe(true);
        expect(search.clientId).toBe("test");
    });

    it("keeps an all-digit sid, which parses as a number", () => {
        // Hosts mint these from timestamps and counters; dropping the value
        // would cost every callback its session id.
        expect(fromUrl("?sid=1738147200000").sid).toBe("1738147200000");
        expect(fromUrl("?sid=abc123").sid).toBe("abc123");
    });

    it("keeps an sdkv that looks numeric", () => {
        expect(fromUrl("?sdkv=0.1.0").sdkv).toBe("0.1.0");
        // A two-part version parses as a number, and an unidentifiable binary
        // is exactly what `sdkv` exists to prevent.
        expect(fromUrl("?sdkv=0.1").sdkv).toBe("0.1");
    });

    it("still rejects a native launch with no clientId", () => {
        expect(() =>
            beforeLoad({ search: fromUrl("?native=1&merchantId=m1") })
        ).toThrow(/clientId/);
    });
});
