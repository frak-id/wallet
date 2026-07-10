import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopifySsoService } from "./ShopifySsoService";

describe("ShopifySsoService.isValidShopDomain", () => {
    const service = new ShopifySsoService();

    it("accepts a well-formed myshopify.com domain", () => {
        expect(service.isValidShopDomain("my-shop.myshopify.com")).toBe(true);
        expect(service.isValidShopDomain("shop123.myshopify.com")).toBe(true);
    });

    it("rejects domains missing the myshopify.com suffix", () => {
        expect(service.isValidShopDomain("my-shop.com")).toBe(false);
        expect(
            service.isValidShopDomain("my-shop.myshopify.com.evil.com")
        ).toBe(false);
    });

    it("rejects a domain starting with a hyphen", () => {
        expect(service.isValidShopDomain("-shop.myshopify.com")).toBe(false);
    });

    it("rejects protocol/path injection attempts", () => {
        expect(service.isValidShopDomain("https://my-shop.myshopify.com")).toBe(
            false
        );
        expect(service.isValidShopDomain("my-shop.myshopify.com/admin")).toBe(
            false
        );
    });
});

describe("ShopifySsoService.verifyCallbackHmac", () => {
    const service = new ShopifySsoService();
    const ORIGINAL_ENV = process.env.SHOPIFY_API_SECRET;

    beforeEach(() => {
        process.env.SHOPIFY_API_SECRET = "hush";
    });

    afterEach(() => {
        process.env.SHOPIFY_API_SECRET = ORIGINAL_ENV;
    });

    // Known vector: HMAC-SHA256("hush", "code=abc123&shop=my-shop.myshopify.com&state=nonce&timestamp=1700000000")
    const KNOWN_HMAC =
        "3bf87468e42fc970e12333f48bd8f213abd85186c5bb04e613921b764b0e0419";

    it("accepts a correctly computed HMAC", () => {
        const params = new URLSearchParams({
            code: "abc123",
            shop: "my-shop.myshopify.com",
            state: "nonce",
            timestamp: "1700000000",
            hmac: KNOWN_HMAC,
        });
        expect(service.verifyCallbackHmac(params)).toBe(true);
    });

    it("is insensitive to query param insertion order", () => {
        const params = new URLSearchParams({
            state: "nonce",
            timestamp: "1700000000",
            hmac: KNOWN_HMAC,
            shop: "my-shop.myshopify.com",
            code: "abc123",
        });
        expect(service.verifyCallbackHmac(params)).toBe(true);
    });

    it("rejects a tampered param", () => {
        const params = new URLSearchParams({
            code: "abc123-tampered",
            shop: "my-shop.myshopify.com",
            state: "nonce",
            timestamp: "1700000000",
            hmac: KNOWN_HMAC,
        });
        expect(service.verifyCallbackHmac(params)).toBe(false);
    });

    it("rejects a missing hmac param", () => {
        const params = new URLSearchParams({
            code: "abc123",
            shop: "my-shop.myshopify.com",
        });
        expect(service.verifyCallbackHmac(params)).toBe(false);
    });

    it("rejects when SHOPIFY_API_SECRET is unset", () => {
        process.env.SHOPIFY_API_SECRET = "";
        const params = new URLSearchParams({
            code: "abc123",
            shop: "my-shop.myshopify.com",
            state: "nonce",
            timestamp: "1700000000",
            hmac: KNOWN_HMAC,
        });
        expect(service.verifyCallbackHmac(params)).toBe(false);
    });
});

describe("ShopifySsoService.createAuthorizationUrl", () => {
    const service = new ShopifySsoService();

    it("targets the shop's own admin OAuth endpoint with per-user grant options", () => {
        const url = service.createAuthorizationUrl({
            shop: "my-shop.myshopify.com",
            callbackUrl:
                "https://backend.frak.id/business/auth/shopify/callback",
            state: "the-state",
        });

        expect(url.origin).toBe("https://my-shop.myshopify.com");
        expect(url.pathname).toBe("/admin/oauth/authorize");
        expect(url.searchParams.get("state")).toBe("the-state");
        expect(url.searchParams.get("grant_options[]")).toBe("per-user");
        expect(url.searchParams.get("redirect_uri")).toBe(
            "https://backend.frak.id/business/auth/shopify/callback"
        );
    });
});

describe("ShopifySsoService.exchangeCodeForIdentity", () => {
    const service = new ShopifySsoService();
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        process.env.SHOPIFY_CLIENT_ID = "client-id";
        process.env.SHOPIFY_API_SECRET = "hush";
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        process.env.SHOPIFY_CLIENT_ID = ORIGINAL_ENV.SHOPIFY_CLIENT_ID;
        process.env.SHOPIFY_API_SECRET = ORIGINAL_ENV.SHOPIFY_API_SECRET;
        vi.unstubAllGlobals();
    });

    it("extracts the associated_user identity and discards the access token", async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(
                JSON.stringify({
                    access_token: "should-not-be-returned",
                    associated_user: {
                        id: 12345,
                        email: "staff@my-shop.com",
                        account_owner: true,
                    },
                }),
                { status: 200 }
            )
        );

        const identity = await service.exchangeCodeForIdentity({
            shop: "my-shop.myshopify.com",
            code: "abc123",
            callbackUrl:
                "https://backend.frak.id/business/auth/shopify/callback",
        });

        expect(identity).toEqual({
            shopDomain: "my-shop.myshopify.com",
            associatedUser: {
                id: "12345",
                email: "staff@my-shop.com",
            },
        });
        expect(identity).not.toHaveProperty("accessToken");
    });

    it("returns null when the response has no associated_user (offline token)", async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(
                JSON.stringify({ access_token: "offline-token-no-user" }),
                { status: 200 }
            )
        );

        const identity = await service.exchangeCodeForIdentity({
            shop: "my-shop.myshopify.com",
            code: "abc123",
            callbackUrl:
                "https://backend.frak.id/business/auth/shopify/callback",
        });

        expect(identity).toBeNull();
    });

    it("returns null on a non-ok response", async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response("invalid_grant", { status: 400 })
        );

        const identity = await service.exchangeCodeForIdentity({
            shop: "my-shop.myshopify.com",
            code: "bad-code",
            callbackUrl:
                "https://backend.frak.id/business/auth/shopify/callback",
        });

        expect(identity).toBeNull();
    });
});
