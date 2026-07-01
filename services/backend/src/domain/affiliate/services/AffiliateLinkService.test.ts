import { HttpError } from "@backend-utils";
import { describe, expect, it, vi } from "vitest";
import { AffiliateLinkService } from "./AffiliateLinkService";

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
const IDENTITY_GROUP_ID = "22222222-2222-2222-2222-222222222222";

function makeService(
    opts: {
        brand?: { merchantId: string; trackingLink: string } | null;
        existingBrandForExternalId?: { merchantId: string } | null;
        existingToken?: string;
        existingAttribution?: { token: string } | null;
    } = {}
) {
    const brand =
        opts.brand === undefined
            ? {
                  merchantId: MERCHANT_ID,
                  trackingLink: "https://go.takeads.com/brand",
              }
            : opts.brand;

    const affiliateBrandRepository = {
        findByMerchantAndProvider: vi.fn(() => Promise.resolve(brand as never)),
        findByProviderAndExternalId: vi.fn(() =>
            Promise.resolve((opts.existingBrandForExternalId ?? null) as never)
        ),
        link: vi.fn(() => Promise.resolve()),
    };

    // `mint` echoes back the token it was handed unless a pre-existing token is
    // configured (simulating reuse / a lost insert race).
    const affiliateAttributionRepository = {
        mint: vi.fn((params: { token: string }) =>
            Promise.resolve({
                token: opts.existingToken ?? params.token,
            } as never)
        ),
        findByUserAndBrand: vi.fn(() =>
            Promise.resolve((opts.existingAttribution ?? null) as never)
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

describe("AffiliateLinkService.getOrCreateShareLink", () => {
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
        expect(result.provider).toBe("takeads");

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
            brand: {
                merchantId: MERCHANT_ID,
                trackingLink: "https://go.takeads.com/b?utm=x",
            },
        });

        const url = new URL(
            (await service.getOrCreateShareLink(baseParams)).url
        );
        expect(url.searchParams.get("utm")).toBe("x");
        expect(url.searchParams.get("s")).toBeTruthy();
    });
});

describe("AffiliateLinkService.getShareLink", () => {
    it("throws 404 when the merchant is not linked to the provider", async () => {
        const { service } = makeService({ brand: null });

        await expect(service.getShareLink(baseParams)).rejects.toThrow(
            HttpError
        );
    });

    it("returns null without minting when the user has no link yet", async () => {
        const { service, affiliateAttributionRepository } = makeService({
            existingAttribution: null,
        });

        const result = await service.getShareLink(baseParams);

        expect(result).toBeNull();
        // Read-only: never mints.
        expect(affiliateAttributionRepository.mint).not.toHaveBeenCalled();
    });

    it("returns the existing link built from the stored token", async () => {
        const { service, affiliateAttributionRepository } = makeService({
            existingAttribution: { token: "EXISTING_TOKEN" },
        });

        const result = await service.getShareLink(baseParams);

        expect(result).not.toBeNull();
        expect(result?.token).toBe("EXISTING_TOKEN");
        expect(new URL(result?.url ?? "").searchParams.get("s")).toBe(
            "EXISTING_TOKEN"
        );
        expect(affiliateAttributionRepository.mint).not.toHaveBeenCalled();
    });
});

describe("AffiliateLinkService.registerBrand", () => {
    const registerParams = {
        merchantId: MERCHANT_ID,
        externalId: "12345",
        trackingLink: "https://go.takeads.com/brand",
    };

    it("links the brand when the tracking link is a valid https URL", async () => {
        const { service, affiliateBrandRepository } = makeService();

        await service.registerBrand(registerParams);

        expect(affiliateBrandRepository.link).toHaveBeenCalledWith(
            expect.objectContaining({
                merchantId: MERCHANT_ID,
                provider: "takeads",
                externalId: "12345",
                trackingLink: "https://go.takeads.com/brand",
            })
        );
    });

    it("rejects a malformed tracking link", async () => {
        const { service, affiliateBrandRepository } = makeService();

        await expect(
            service.registerBrand({
                ...registerParams,
                trackingLink: "not-a-url",
            })
        ).rejects.toThrow(HttpError);
        expect(affiliateBrandRepository.link).not.toHaveBeenCalled();
    });

    it("rejects a non-https tracking link", async () => {
        const { service, affiliateBrandRepository } = makeService();

        await expect(
            service.registerBrand({
                ...registerParams,
                trackingLink: "http://go.takeads.com/brand",
            })
        ).rejects.toThrow(HttpError);
        expect(affiliateBrandRepository.link).not.toHaveBeenCalled();
    });

    it("refuses to steal a brand already linked to another merchant", async () => {
        const { service, affiliateBrandRepository } = makeService({
            existingBrandForExternalId: { merchantId: "other-merchant" },
        });

        await expect(service.registerBrand(registerParams)).rejects.toThrow(
            HttpError
        );
        expect(affiliateBrandRepository.link).not.toHaveBeenCalled();
    });

    it("re-links idempotently for the same merchant", async () => {
        const { service, affiliateBrandRepository } = makeService({
            existingBrandForExternalId: { merchantId: MERCHANT_ID },
        });

        await service.registerBrand(registerParams);

        expect(affiliateBrandRepository.link).toHaveBeenCalled();
    });
});
