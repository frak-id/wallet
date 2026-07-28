import { describe, expect, it } from "vitest";
import { Route } from "./sharing";

// `validateSearch` is the whole native-facing param contract, and a shipped
// SDK binary can never be updated to match a change here.
const validateSearch = Route.options.validateSearch as (
    search: Record<string, unknown>
) => Record<string, unknown>;

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
        expect(validateSearch({ native: "1" }).native).toBe(true);
        expect(validateSearch({ native: true }).native).toBe(true);
        expect(validateSearch({ native: "0" }).native).toBe(false);
        expect(validateSearch({}).native).toBe(false);

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
