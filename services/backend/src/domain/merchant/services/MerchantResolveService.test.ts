import { describe, expect, it } from "vitest";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import type { SdkConfig } from "../schemas";
import { MerchantResolveService } from "./MerchantResolveService";

function createService(sdkConfig: SdkConfig | null) {
    const merchant = {
        id: "merchant-id",
        productId: null,
        domain: "example.com",
        allowedDomains: [],
        name: "Example",
        ownerWallet: "0x0000000000000000000000000000000000000000",
        bankAddress: null,
        defaultRewardToken: "0x0000000000000000000000000000000000000000",
        webhookSignatureKey: null,
        webhookPlatform: null,
        explorerConfig: null,
        explorerEnabledAt: null,
        sdkConfig,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const repository = {
        findByDomain: async () => merchant,
        findByAllowedDomain: async () => null,
        findById: async () => merchant,
    } as unknown as MerchantRepository;
    return new MerchantResolveService(repository);
}

describe("MerchantResolveService localizable text", () => {
    it("resolves a per-language component text to the requested language", async () => {
        const config: SdkConfig = {
            components: {
                buttonShare: {
                    text: { en: "Share and earn!", fr: "Partagez et gagnez !" },
                },
            },
        };

        const en = await createService(config).resolve({
            domain: "example.com",
            lang: "en",
        });
        expect(en?.sdkConfig?.components?.buttonShare?.text).toBe(
            "Share and earn!"
        );

        const fr = await createService(config).resolve({
            domain: "example.com",
            lang: "fr",
        });
        expect(fr?.sdkConfig?.components?.buttonShare?.text).toBe(
            "Partagez et gagnez !"
        );
    });

    it("treats a bare string as language-agnostic (backward compatible)", async () => {
        const config: SdkConfig = {
            components: { openInApp: { text: "Open in App" } },
        };

        const fr = await createService(config).resolve({
            domain: "example.com",
            lang: "fr",
        });
        expect(fr?.sdkConfig?.components?.openInApp?.text).toBe("Open in App");
    });

    it("falls back to the default bucket when the language is missing", async () => {
        const config: SdkConfig = {
            components: {
                buttonShare: {
                    text: { default: "Default copy", en: "English copy" },
                },
            },
        };

        const fr = await createService(config).resolve({
            domain: "example.com",
            lang: "fr",
        });
        expect(fr?.sdkConfig?.components?.buttonShare?.text).toBe(
            "Default copy"
        );
    });

    it("resolves placement-level component text per language", async () => {
        const config: SdkConfig = {
            placements: {
                hero: {
                    components: {
                        banner: {
                            referralCta: {
                                en: "Got it",
                                fr: "J'ai compris",
                            },
                        },
                    },
                },
            },
        };

        const fr = await createService(config).resolve({
            domain: "example.com",
            lang: "fr",
        });
        expect(
            fr?.sdkConfig?.placements?.hero?.components?.banner?.referralCta
        ).toBe("J'ai compris");
    });
});
