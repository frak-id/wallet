import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignBankService } from "./CampaignBankService";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const BANK = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const MERCHANT_ID = "merchant-123";

function makeService(
    opts: {
        ownerWallet?: Address | null;
        bankAddress?: Address | null;
        hasRole?: boolean;
    } = {}
) {
    const merchant = {
        id: MERCHANT_ID,
        ownerWallet: opts.ownerWallet === undefined ? OWNER : opts.ownerWallet,
        bankAddress: opts.bankAddress === undefined ? BANK : opts.bankAddress,
    };

    const bankRepo = {
        deployBank: vi.fn(() => Promise.resolve({ bankAddress: BANK })),
        grantManagerRole: vi.fn(() => Promise.resolve()),
        revokeManagerRole: vi.fn(() => Promise.resolve()),
        hasManagerRole: vi.fn(() => Promise.resolve(opts.hasRole ?? false)),
        enableDistribution: vi.fn(() => Promise.resolve()),
    };
    const merchantRepo = {
        findById: vi.fn(() => Promise.resolve(merchant as never)),
        updateBankAddress: vi.fn(() => Promise.resolve(merchant as never)),
    };

    const service = new CampaignBankService(
        bankRepo as never,
        merchantRepo as never
    );
    return { service, bankRepo, merchantRepo };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("CampaignBankService — walletless owner tolerance (§4.9/§4.10)", () => {
    it("deployAndSetupBank skips the manager-role grant when owner has no wallet", async () => {
        const { service, bankRepo } = makeService({
            ownerWallet: null,
            bankAddress: null,
        });

        const result = await service.deployAndSetupBank(MERCHANT_ID);

        expect(result.bankAddress).toBe(BANK);
        expect(bankRepo.deployBank).toHaveBeenCalledTimes(1);
        expect(bankRepo.grantManagerRole).not.toHaveBeenCalled();
        expect(bankRepo.enableDistribution).toHaveBeenCalledTimes(1);
    });

    it("deployAndSetupBank grants the role for a wallet owner", async () => {
        const { service, bankRepo } = makeService({ bankAddress: null });

        await service.deployAndSetupBank(MERCHANT_ID);

        expect(bankRepo.grantManagerRole).toHaveBeenCalledWith(
            MERCHANT_ID,
            BANK,
            OWNER
        );
    });

    it("syncBankRoles no-ops for a walletless owner", async () => {
        const { service, bankRepo } = makeService({ ownerWallet: null });

        const result = await service.syncBankRoles(MERCHANT_ID);

        expect(result).toEqual({ rolesGranted: false, rolesRevoked: false });
        expect(bankRepo.hasManagerRole).not.toHaveBeenCalled();
        expect(bankRepo.grantManagerRole).not.toHaveBeenCalled();
    });

    it("getBankStatus returns managerRole no_wallet for a walletless owner", async () => {
        const { service, bankRepo } = makeService({ ownerWallet: null });

        const result = await service.getBankStatus(MERCHANT_ID);

        expect(result).toEqual({
            deployed: true,
            bankAddress: BANK,
            ownerHasManagerRole: false,
            managerRole: "no_wallet",
        });
        expect(bankRepo.hasManagerRole).not.toHaveBeenCalled();
    });

    it("getBankStatus returns granted when the wallet owner holds the role", async () => {
        const { service } = makeService({ hasRole: true });

        const result = await service.getBankStatus(MERCHANT_ID);

        expect(result.managerRole).toBe("granted");
        expect(result.ownerHasManagerRole).toBe(true);
    });

    it("getBankStatus returns missing when the wallet owner lacks the role", async () => {
        const { service } = makeService({ hasRole: false });

        const result = await service.getBankStatus(MERCHANT_ID);

        expect(result.managerRole).toBe("missing");
    });

    it("getBankStatus reports no_wallet for an undeployed walletless merchant", async () => {
        const { service } = makeService({
            ownerWallet: null,
            bankAddress: null,
        });

        const result = await service.getBankStatus(MERCHANT_ID);

        expect(result).toEqual({
            deployed: false,
            bankAddress: null,
            ownerHasManagerRole: false,
            managerRole: "no_wallet",
        });
    });
});
