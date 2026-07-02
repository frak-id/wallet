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
    message: "siwe-message",
    signature: "0xsig" as Address,
    domain: "brand.com",
    name: "Brand",
    requestOrigin: "https://business.frak.id",
    defaultRewardToken: REWARD_TOKEN,
};

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
            wallet: OTHER_ADMIN,
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
