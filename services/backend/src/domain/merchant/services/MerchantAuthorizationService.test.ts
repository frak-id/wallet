import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import { MerchantAuthorizationService } from "./MerchantAuthorizationService";

const MERCHANT_ID = "merchant-1";
const OWNER_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
const OTHER_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address;
const DOMAIN = "shop.myshopify.com";

const merchant = (overrides: Record<string, unknown> = {}) => ({
    id: MERCHANT_ID,
    domain: DOMAIN,
    allowedDomains: null,
    ownerWallet: null,
    ownerAccountId: null,
    ...overrides,
});

const createRepos = () => {
    const merchantRepository = {
        findById: vi.fn(),
        findByOwnerWallet: vi.fn().mockResolvedValue([]),
        findByOwnerAccount: vi.fn().mockResolvedValue([]),
        findAll: vi.fn().mockResolvedValue([]),
    } as unknown as MerchantRepository &
        Record<string, ReturnType<typeof vi.fn>>;
    const merchantAdminRepository = {
        isAdmin: vi.fn().mockResolvedValue(false),
        findByIdentity: vi.fn().mockResolvedValue([]),
    } as unknown as MerchantAdminRepository &
        Record<string, ReturnType<typeof vi.fn>>;
    return { merchantRepository, merchantAdminRepository };
};

describe("MerchantAuthorizationService.checkAccess", () => {
    let repos: ReturnType<typeof createRepos>;
    let service: MerchantAuthorizationService;

    beforeEach(() => {
        repos = createRepos();
        service = new MerchantAuthorizationService(
            repos.merchantRepository,
            repos.merchantAdminRepository
        );
    });

    it("denies an empty identity without hitting the DB", async () => {
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: null,
            shopDomain: null,
        });
        expect(access).toMatchObject({ hasAccess: false, role: "none" });
        expect(repos.merchantRepository.findById).not.toHaveBeenCalled();
    });

    it("denies when the merchant does not exist", async () => {
        repos.merchantRepository.findById.mockResolvedValue(null);
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: OWNER_WALLET,
            accountId: null,
            shopDomain: null,
        });
        expect(access.hasAccess).toBe(false);
    });

    it("grants owner by wallet", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ ownerWallet: OWNER_WALLET })
        );
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: OWNER_WALLET,
            accountId: null,
            shopDomain: null,
        });
        expect(access).toEqual({
            hasAccess: true,
            isOwner: true,
            isAdmin: false,
            role: "owner",
        });
    });

    it("grants owner by accountId (walletless owner)", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ ownerAccountId: "acc-1" })
        );
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: "acc-1",
            shopDomain: null,
        });
        expect(access).toMatchObject({ isOwner: true, role: "owner" });
    });

    it("grants admin via the admin repository", async () => {
        repos.merchantRepository.findById.mockResolvedValue(merchant());
        repos.merchantAdminRepository.isAdmin.mockResolvedValue(true);
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: OTHER_WALLET,
            accountId: null,
            shopDomain: null,
        });
        expect(access).toMatchObject({ isAdmin: true, role: "admin" });
    });

    it("grants admin via the shop-domain auto-link", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ domain: DOMAIN })
        );
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: null,
            shopDomain: DOMAIN,
        });
        expect(access).toMatchObject({ isAdmin: true, role: "admin" });
    });

    it("denies a non-owner non-admin with no shop-domain match", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ ownerWallet: OWNER_WALLET })
        );
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: OTHER_WALLET,
            accountId: null,
            shopDomain: null,
        });
        expect(access.hasAccess).toBe(false);
    });

    it("does not auto-link when the proven shop domain is absent", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ domain: DOMAIN })
        );
        // account has no shopDomain → the domain fallback must not fire.
        const access = await service.checkAccess(MERCHANT_ID, {
            wallet: null,
            accountId: "acc-x",
            shopDomain: null,
        });
        expect(access.hasAccess).toBe(false);
    });
});

describe("MerchantAuthorizationService.hasAccessByDomain", () => {
    let repos: ReturnType<typeof createRepos>;
    let service: MerchantAuthorizationService;

    beforeEach(() => {
        repos = createRepos();
        service = new MerchantAuthorizationService(
            repos.merchantRepository,
            repos.merchantAdminRepository
        );
    });

    it("matches the primary domain", async () => {
        repos.merchantRepository.findById.mockResolvedValue(merchant());
        expect(await service.hasAccessByDomain(MERCHANT_ID, DOMAIN)).toBe(true);
    });

    it("matches an allowed domain alias", async () => {
        repos.merchantRepository.findById.mockResolvedValue(
            merchant({ allowedDomains: ["alias.example.com"] })
        );
        expect(
            await service.hasAccessByDomain(MERCHANT_ID, "alias.example.com")
        ).toBe(true);
    });

    it("rejects an unrelated domain", async () => {
        repos.merchantRepository.findById.mockResolvedValue(merchant());
        expect(
            await service.hasAccessByDomain(MERCHANT_ID, "evil.example.com")
        ).toBe(false);
    });
});

describe("MerchantAuthorizationService.getAccessibleMerchantIds", () => {
    let repos: ReturnType<typeof createRepos>;
    let service: MerchantAuthorizationService;

    beforeEach(() => {
        repos = createRepos();
        service = new MerchantAuthorizationService(
            repos.merchantRepository,
            repos.merchantAdminRepository
        );
    });

    it("unions and dedupes ids from every access source", async () => {
        repos.merchantRepository.findByOwnerWallet.mockResolvedValue([
            { id: "m1" },
        ]);
        repos.merchantRepository.findByOwnerAccount.mockResolvedValue([
            { id: "m1" }, // duplicate of the wallet-owned merchant
            { id: "m2" },
        ]);
        repos.merchantAdminRepository.findByIdentity.mockResolvedValue([
            { merchantId: "m3" },
        ]);
        repos.merchantRepository.findAll.mockResolvedValue([
            { id: "m4", domain: DOMAIN, allowedDomains: null },
        ]);

        const ids = await service.getAccessibleMerchantIds({
            wallet: OWNER_WALLET,
            accountId: "acc-1",
            shopDomain: DOMAIN,
        });
        expect([...ids].sort()).toEqual(["m1", "m2", "m3", "m4"]);
    });
});
