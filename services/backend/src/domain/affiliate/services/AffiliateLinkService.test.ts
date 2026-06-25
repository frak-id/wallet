import { HttpError } from "@backend-utils";
import { describe, expect, it, vi } from "vitest";
import { AffiliateLinkService } from "./AffiliateLinkService";

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
const IDENTITY_GROUP_ID = "22222222-2222-2222-2222-222222222222";

function makeService(
    opts: {
        brand?: { trackingLink: string } | null;
        existingToken?: string;
        couponCode?: string | null;
    } = {}
) {
    const brand =
        opts.brand === undefined
            ? { trackingLink: "https://go.takeads.com/brand" }
            : opts.brand;

    const affiliateBrandRepository = {
        findByMerchantAndProvider: vi.fn(() => Promise.resolve(brand as never)),
    };

    // `mint` echoes back the token it was handed unless a pre-existing token is
    // configured (simulating reuse / a lost insert race).
    const affiliateAttributionRepository = {
        mint: vi.fn((params: { token: string }) =>
            Promise.resolve({
                token: opts.existingToken ?? params.token,
                couponCode: opts.couponCode ?? null,
            } as never)
        ),
    };

    const service = new AffiliateLinkService(
        affiliateBrandRepository as never,
        affiliateAttributionRepository as never
    );

    return {
        service,
        affiliateBrandRepository,
        affiliateAttributionRepository,
    };
}

const baseParams = {
    merchantId: MERCHANT_ID,
    identityGroupId: IDENTITY_GROUP_ID,
};

describe("AffiliateLinkService", () => {
    it("throws 404 when the merchant is not linked to the provider", async () => {
        const { service, affiliateAttributionRepository } = makeService({
            brand: null,
        });

        await expect(service.getOrCreateShareLink(baseParams)).rejects.toThrow(
            HttpError
        );
        expect(affiliateAttributionRepository.mint).not.toHaveBeenCalled();
    });

    it("mints a token bound to the caller and sets the provider sub-id param", async () => {
        const { service, affiliateAttributionRepository } = makeService();

        const result = await service.getOrCreateShareLink(baseParams);

        // TakeAds sub-id param is `s`.
        const url = new URL(result.url);
        expect(url.searchParams.get("s")).toBe(result.token);
        expect(url.origin + url.pathname).toBe("https://go.takeads.com/brand");

        // Token is server-minted and bound to the identity group.
        expect(affiliateAttributionRepository.mint).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "takeads",
                merchantId: MERCHANT_ID,
                identityGroupId: IDENTITY_GROUP_ID,
                token: result.token,
                trackingLink: "https://go.takeads.com/brand",
            })
        );
    });

    it("returns the existing token on reuse (idempotent / race-safe)", async () => {
        const { service } = makeService({ existingToken: "REUSED_TOKEN_123" });

        const result = await service.getOrCreateShareLink(baseParams);

        expect(result.token).toBe("REUSED_TOKEN_123");
        expect(new URL(result.url).searchParams.get("s")).toBe(
            "REUSED_TOKEN_123"
        );
    });

    it("preserves existing query params on the tracking link", async () => {
        const { service } = makeService({
            brand: { trackingLink: "https://go.takeads.com/b?utm=x" },
        });

        const url = new URL(
            (await service.getOrCreateShareLink(baseParams)).url
        );
        expect(url.searchParams.get("utm")).toBe("x");
        expect(url.searchParams.get("s")).toBeTruthy();
    });

    it("surfaces the coupon code when present", async () => {
        const { service } = makeService({ couponCode: "SAVE10" });

        const result = await service.getOrCreateShareLink(baseParams);

        expect(result.couponCode).toBe("SAVE10");
    });
});
