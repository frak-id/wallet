import { describe, expect, it } from "vitest";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import type { SdkConfig } from "../schemas";
import {
    MerchantResolveService,
    normalizePackageId,
} from "./MerchantResolveService";

function buildMerchant(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: "merchant-id",
        productId: null,
        domain: "example.com",
        allowedDomains: [],
        allowedPackageIds: [],
        name: "Example",
        ownerWallet: "0x0000000000000000000000000000000000000000",
        bankAddress: null,
        defaultRewardToken: "0x0000000000000000000000000000000000000000",
        webhookSignatureKey: null,
        webhookPlatform: null,
        explorerConfig: null,
        explorerEnabledAt: null,
        sdkConfig: null,
        verifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function createService(sdkConfig: SdkConfig | null) {
    const merchant = buildMerchant({ sdkConfig });
    const repository = {
        findByDomain: async () => merchant,
        findByAllowedDomain: async () => null,
        findByAllowedPackageId: async () => null,
        findById: async () => merchant,
    } as unknown as MerchantRepository;
    return new MerchantResolveService(repository);
}

/**
 * A mutable in-memory stand-in for MerchantRepository, so invalidation tests
 * can assert the cache actually clears rather than trusting the key strings.
 */
function createMutableRepository(initial: ReturnType<typeof buildMerchant>) {
    let current = initial;
    return {
        repository: {
            findById: async (id: string) =>
                id === current.id ? current : null,
            findByDomain: async (domain: string) =>
                domain === current.domain ? current : null,
            findByAllowedDomain: async (domain: string) =>
                (current.allowedDomains ?? []).includes(domain)
                    ? current
                    : null,
            findByAllowedPackageId: async (packageKey: string) =>
                (current.allowedPackageIds ?? []).includes(packageKey)
                    ? current
                    : null,
        } as unknown as MerchantRepository,
        setName(name: string) {
            current = { ...current, name };
        },
        get merchant() {
            return current;
        },
    };
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

describe("normalizePackageId", () => {
    it("prefixes by platform and lowercases + trims the package id", () => {
        expect(
            normalizePackageId("com.groupeseb.Moulinex.Food ", "android")
        ).toBe("android:com.groupeseb.moulinex.food");
        expect(normalizePackageId(" com.groupeseb.MyMoulinex", "ios")).toBe(
            "ios:com.groupeseb.mymoulinex"
        );
    });

    it("the same platform+id normalizes identically regardless of case", () => {
        expect(normalizePackageId("Com.Example.App", "android")).toBe(
            normalizePackageId("com.example.app", "android")
        );
    });
});

describe("MerchantResolveService package-id resolution", () => {
    function createServiceWithPackageId(packageId: string, platform: string) {
        const merchant = buildMerchant({
            allowedPackageIds: [
                normalizePackageId(packageId, platform as never),
            ],
        });
        const repository = {
            findById: async () => null,
            findByDomain: async () => null,
            findByAllowedDomain: async () => null,
            findByAllowedPackageId: async (packageKey: string) =>
                merchant.allowedPackageIds.includes(packageKey)
                    ? merchant
                    : null,
        } as unknown as MerchantRepository;
        return { service: new MerchantResolveService(repository), merchant };
    }

    it("resolves a merchant by packageId + platform", async () => {
        const { service } = createServiceWithPackageId(
            "com.groupeseb.moulinex.food",
            "android"
        );

        const result = await service.resolve({
            packageId: "com.groupeseb.moulinex.food",
            platform: "android",
        });

        expect(result?.merchantId).toBe("merchant-id");
    });

    it("matches case-insensitively", async () => {
        const { service } = createServiceWithPackageId(
            "com.groupeseb.moulinex.food",
            "android"
        );

        const result = await service.resolve({
            packageId: "COM.GroupeSEB.Moulinex.Food",
            platform: "android",
        });

        expect(result?.merchantId).toBe("merchant-id");
    });

    it("yields the same productId as resolving the same merchant by id", async () => {
        const { service, merchant } = createServiceWithPackageId(
            "com.groupeseb.moulinex.food",
            "android"
        );
        const byId = {
            findById: async () => merchant,
            findByDomain: async () => null,
            findByAllowedDomain: async () => null,
            findByAllowedPackageId: async () => null,
        } as unknown as MerchantRepository;
        const serviceById = new MerchantResolveService(byId);

        const viaPackage = await service.resolve({
            packageId: "com.groupeseb.moulinex.food",
            platform: "android",
        });
        const viaId = await serviceById.resolve({ id: merchant.id });

        expect(viaPackage?.productId).toBe(viaId?.productId);
    });

    it("returns null when no lookup axis matches", async () => {
        const { service } = createServiceWithPackageId(
            "com.groupeseb.moulinex.food",
            "android"
        );

        const result = await service.resolve({
            packageId: "com.other.app",
            platform: "android",
        });

        expect(result).toBeNull();
    });
});

describe("MerchantResolveService cache invalidation", () => {
    it("invalidates a domain-resolved entry", async () => {
        const { repository, setName } = createMutableRepository(
            buildMerchant({ name: "Original" })
        );
        const service = new MerchantResolveService(repository);

        const before = await service.resolve({ domain: "example.com" });
        expect(before?.name).toBe("Original");

        setName("Updated");
        service.invalidateForMerchant(
            (await repository.findById("merchant-id")) as never
        );

        const after = await service.resolve({ domain: "example.com" });
        expect(after?.name).toBe("Updated");
    });

    it("invalidates an id-resolved entry independently of the domain entry", async () => {
        const { repository, setName } = createMutableRepository(
            buildMerchant({ name: "Original" })
        );
        const service = new MerchantResolveService(repository);

        await service.resolve({ domain: "example.com" });
        const beforeById = await service.resolve({ id: "merchant-id" });
        expect(beforeById?.name).toBe("Original");

        setName("Updated");
        service.invalidateForMerchant(
            (await repository.findById("merchant-id")) as never
        );

        const afterById = await service.resolve({ id: "merchant-id" });
        const afterByDomain = await service.resolve({ domain: "example.com" });
        expect(afterById?.name).toBe("Updated");
        expect(afterByDomain?.name).toBe("Updated");
    });

    it("invalidates a package-id-resolved entry", async () => {
        const packageKey = normalizePackageId(
            "com.groupeseb.moulinex.food",
            "android"
        );
        const { repository, setName } = createMutableRepository(
            buildMerchant({ name: "Original", allowedPackageIds: [packageKey] })
        );
        const service = new MerchantResolveService(repository);

        const before = await service.resolve({
            packageId: "com.groupeseb.moulinex.food",
            platform: "android",
        });
        expect(before?.name).toBe("Original");

        setName("Updated");
        service.invalidateForMerchant(
            (await repository.findById("merchant-id")) as never
        );

        const after = await service.resolve({
            packageId: "com.groupeseb.moulinex.food",
            platform: "android",
        });
        expect(after?.name).toBe("Updated");
    });

    it("does not invalidate a merchant that was not passed in", async () => {
        const { repository, setName } = createMutableRepository(
            buildMerchant({ name: "Original" })
        );
        const service = new MerchantResolveService(repository);

        await service.resolve({ domain: "example.com" });
        setName("Updated");

        service.invalidateForMerchant(
            buildMerchant({
                id: "other-merchant",
                domain: "other.com",
            }) as never
        );

        const stillCached = await service.resolve({ domain: "example.com" });
        expect(stillCached?.name).toBe("Original");
    });
});
