import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    FRAK_SHARED_CAMPAIGN_BANK,
    MerchantRegistrationService,
} from "./MerchantRegistrationService";

const ADMIN_WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const OTHER_ADMIN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const NON_ADMIN = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const REWARD_TOKEN = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;

function makeService(
    opts: {
        signerWallet?: Address;
        existingDomain?: string;
        dnsValid?: boolean;
    } = {}
) {
    const signerWallet = opts.signerWallet ?? ADMIN_WALLET;

    const merchantRepo = {
        findByDomain: vi.fn((domain: string) =>
            Promise.resolve(
                opts.existingDomain && domain === opts.existingDomain
                    ? ({ id: "existing", domain } as never)
                    : null
            )
        ),
        create: vi.fn((merchant: Record<string, unknown>) =>
            Promise.resolve({ id: "new-merchant-id", ...merchant } as never)
        ),
    };
    const dnsRepo = {
        getNormalizedDomain: vi.fn((domain: string) =>
            domain.replace(/^www\./, "")
        ),
        isValidDomain: vi.fn(() => Promise.resolve(opts.dnsValid ?? true)),
    };
    const adminRepo = {
        add: vi.fn((params: Record<string, unknown>) =>
            Promise.resolve(params as never)
        ),
    };

    const service = new MerchantRegistrationService(
        merchantRepo as never,
        dnsRepo as never,
        adminRepo as never
    );

    // Stub SIWE verification so tests exercise the registration logic, not
    // the on-chain signature check.
    vi.spyOn(service, "verifySiweMessage").mockResolvedValue({
        valid: true,
        wallet: signerWallet,
    });

    return { service, merchantRepo, dnsRepo, adminRepo };
}

const baseParams = {
    identity: {
        type: "wallet" as const,
        message: "siwe-message",
        signature: "0xsig" as Address,
    },
    domain: "brand.com",
    name: "Brand",
    requestOrigin: "https://business.frak.id",
    defaultRewardToken: REWARD_TOKEN,
};

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("MerchantRegistrationService.register — platform-admin options", () => {
    it("skips DNS validation when an admin opts in", async () => {
        const { service, dnsRepo, merchantRepo } = makeService({
            signerWallet: ADMIN_WALLET,
        });

        const result = await service.register({
            ...baseParams,
            skipDomainValidation: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(dnsRepo.isValidDomain).not.toHaveBeenCalled();
        expect(merchantRepo.create).toHaveBeenCalledTimes(1);
        expect(result.merchantId).toBe("new-merchant-id");
    });

    it("still validates DNS for a non-admin even if the flag is set", async () => {
        const { service, dnsRepo } = makeService({
            signerWallet: NON_ADMIN,
            dnsValid: false,
        });

        await expect(
            service.register({
                ...baseParams,
                skipDomainValidation: true,
                platformAdminWallets: [ADMIN_WALLET],
            })
        ).rejects.toMatchObject({
            status: 400,
            code: "DNS_VERIFICATION_FAILED",
        });
        expect(dnsRepo.isValidDomain).toHaveBeenCalledTimes(1);
    });

    it("validates DNS for an admin who does not opt out", async () => {
        const { service, dnsRepo } = makeService({
            signerWallet: ADMIN_WALLET,
        });

        await service.register({
            ...baseParams,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(dnsRepo.isValidDomain).toHaveBeenCalledTimes(1);
    });

    it("links the shared Frak bank when an admin opts in", async () => {
        const { service, merchantRepo } = makeService({
            signerWallet: ADMIN_WALLET,
        });

        const result = await service.register({
            ...baseParams,
            useFrakBank: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(result.frakBankLinked).toBe(true);
        expect(result.isPlatformAdmin).toBe(true);
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.bankAddress).toBe(FRAK_SHARED_CAMPAIGN_BANK);
    });

    it("ignores useFrakBank for a non-admin", async () => {
        const { service, merchantRepo } = makeService({
            signerWallet: NON_ADMIN,
        });

        const result = await service.register({
            ...baseParams,
            useFrakBank: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(result.frakBankLinked).toBe(false);
        expect(result.isPlatformAdmin).toBe(false);
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.bankAddress).toBeUndefined();
    });

    it("co-admins the other platform admins onto an admin registration", async () => {
        const { service, adminRepo } = makeService({
            signerWallet: ADMIN_WALLET,
        });

        await service.register({
            ...baseParams,
            platformAdminWallets: [ADMIN_WALLET, OTHER_ADMIN],
        });

        expect(adminRepo.add).toHaveBeenCalledTimes(1);
        expect(adminRepo.add).toHaveBeenCalledWith({
            merchantId: "new-merchant-id",
            identity: { wallet: OTHER_ADMIN },
            addedBy: ADMIN_WALLET,
        });
    });

    it("does not co-admin anyone for a non-admin registration", async () => {
        const { service, adminRepo } = makeService({
            signerWallet: NON_ADMIN,
        });

        await service.register({
            ...baseParams,
            platformAdminWallets: [ADMIN_WALLET, OTHER_ADMIN],
        });

        expect(adminRepo.add).not.toHaveBeenCalled();
    });

    it("rejects a domain that is already registered", async () => {
        const { service, merchantRepo } = makeService({
            signerWallet: ADMIN_WALLET,
            existingDomain: "brand.com",
        });

        await expect(
            service.register({
                ...baseParams,
                platformAdminWallets: [ADMIN_WALLET],
            })
        ).rejects.toMatchObject({
            status: 409,
            code: "DOMAIN_ALREADY_REGISTERED",
        });
        expect(merchantRepo.create).not.toHaveBeenCalled();
    });
});

describe("MerchantRegistrationService.register — identity paths (§4.10)", () => {
    it("wallet path: stores the SIWE wallet and the session account", async () => {
        const { service, merchantRepo } = makeService({
            signerWallet: NON_ADMIN,
        });

        await service.register({
            ...baseParams,
            identity: { ...baseParams.identity, accountId: ACCOUNT_ID },
        });

        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.ownerWallet).toBe(NON_ADMIN);
        expect(created.ownerAccountId).toBe(ACCOUNT_ID);
    });

    it("walletless path: registers with owner_wallet NULL and account set", async () => {
        const { service, merchantRepo, dnsRepo } = makeService();

        const result = await service.register({
            ...baseParams,
            identity: { type: "account", accountId: ACCOUNT_ID },
        });

        expect(result.merchantId).toBe("new-merchant-id");
        expect(result.isPlatformAdmin).toBe(false);
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.ownerWallet).toBeNull();
        expect(created.ownerAccountId).toBe(ACCOUNT_ID);
        // No SIWE verification happens on the account path
        expect(service.verifySiweMessage).not.toHaveBeenCalled();
        // DNS proof binds to the account id, not a wallet
        expect(dnsRepo.isValidDomain).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: { accountId: ACCOUNT_ID },
            })
        );
    });

    it("walletless path: fails DNS verification like the wallet path", async () => {
        const { service } = makeService({ dnsValid: false });

        await expect(
            service.register({
                ...baseParams,
                identity: { type: "account", accountId: ACCOUNT_ID },
            })
        ).rejects.toMatchObject({
            status: 400,
            code: "DNS_VERIFICATION_FAILED",
        });
    });

    it("walletless path: platform-admin options are ignored (wallet-bound)", async () => {
        const { service, merchantRepo, dnsRepo } = makeService();

        const result = await service.register({
            ...baseParams,
            identity: { type: "account", accountId: ACCOUNT_ID },
            skipDomainValidation: true,
            useFrakBank: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(result.isPlatformAdmin).toBe(false);
        expect(result.frakBankLinked).toBe(false);
        // DNS validation still ran despite the skip flag
        expect(dnsRepo.isValidDomain).toHaveBeenCalledTimes(1);
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.bankAddress).toBeUndefined();
    });
});

describe("MerchantRegistrationService.register — Shopify domain bypass (§4.10)", () => {
    it("skips DNS validation when verifiedViaShopify is true", async () => {
        const { service, dnsRepo, merchantRepo } = makeService({
            signerWallet: NON_ADMIN,
            dnsValid: false,
        });

        const result = await service.register({
            ...baseParams,
            identity: { type: "account", accountId: ACCOUNT_ID },
            verifiedViaShopify: true,
        });

        expect(dnsRepo.isValidDomain).not.toHaveBeenCalled();
        expect(merchantRepo.create).toHaveBeenCalledTimes(1);
        expect(result.verifiedViaShopify).toBe(true);
    });

    it("still validates DNS when verifiedViaShopify is false", async () => {
        const { service, dnsRepo } = makeService({ dnsValid: false });

        await expect(
            service.register({
                ...baseParams,
                identity: { type: "account", accountId: ACCOUNT_ID },
                verifiedViaShopify: false,
            })
        ).rejects.toMatchObject({
            status: 400,
            code: "DNS_VERIFICATION_FAILED",
        });
        expect(dnsRepo.isValidDomain).toHaveBeenCalledTimes(1);
    });

    it("is independent of platform-admin status — works for any account", async () => {
        const { service, dnsRepo } = makeService({
            signerWallet: NON_ADMIN,
            dnsValid: false,
        });

        const result = await service.register({
            ...baseParams,
            identity: { type: "account", accountId: ACCOUNT_ID },
            verifiedViaShopify: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(result.isPlatformAdmin).toBe(false);
        expect(dnsRepo.isValidDomain).not.toHaveBeenCalled();
    });

    it("reports verifiedViaShopify: false in the result when not used", async () => {
        const { service } = makeService({ signerWallet: NON_ADMIN });

        const result = await service.register(baseParams);

        expect(result.verifiedViaShopify).toBe(false);
    });
});

describe("MerchantRegistrationService.register — shopify-session identity (§4.12)", () => {
    const shopifySessionParams = {
        ...baseParams,
        identity: {
            type: "shopify-session" as const,
            accountId: ACCOUNT_ID,
            shopDomain: "brand.com",
        },
    };

    it("registers with owner_wallet NULL, owner_account_id set, no DNS check", async () => {
        const { service, merchantRepo, dnsRepo } = makeService({
            dnsValid: false,
        });

        const result = await service.register(shopifySessionParams);

        expect(result.verifiedViaShopify).toBe(true);
        expect(dnsRepo.isValidDomain).not.toHaveBeenCalled();
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.ownerWallet).toBeNull();
        expect(created.ownerAccountId).toBe(ACCOUNT_ID);
        expect(service.verifySiweMessage).not.toHaveBeenCalled();
    });

    it("rejects when the registering domain does not match the token's shop domain", async () => {
        const { service } = makeService();

        await expect(
            service.register({
                ...shopifySessionParams,
                domain: "unrelated.com",
            })
        ).rejects.toMatchObject({ status: 400, code: "DOMAIN_MISMATCH" });
    });

    it("rejects a subdomain of the token's shop domain (route layer decides primaryDomain use, service requires an exact match)", async () => {
        const { service } = makeService();

        await expect(
            service.register({
                ...shopifySessionParams,
                domain: "shop.brand.com",
                identity: {
                    type: "shopify-session",
                    accountId: ACCOUNT_ID,
                    shopDomain: "brand.com",
                },
            })
        ).rejects.toMatchObject({ status: 400, code: "DOMAIN_MISMATCH" });
    });

    it("rejects a duplicate domain with the standard 409", async () => {
        const { service } = makeService({ existingDomain: "brand.com" });

        await expect(
            service.register(shopifySessionParams)
        ).rejects.toMatchObject({
            status: 409,
            code: "DOMAIN_ALREADY_REGISTERED",
        });
    });

    it("ignores platform-admin options (wallet-bound, no wallet here)", async () => {
        const { service, merchantRepo } = makeService();

        const result = await service.register({
            ...shopifySessionParams,
            skipDomainValidation: true,
            useFrakBank: true,
            platformAdminWallets: [ADMIN_WALLET],
        });

        expect(result.isPlatformAdmin).toBe(false);
        expect(result.frakBankLinked).toBe(false);
        const created = merchantRepo.create.mock.calls[0][0];
        expect(created.bankAddress).toBeUndefined();
    });
});
