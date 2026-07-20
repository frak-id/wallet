import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiweVerifyResult } from "../../../utils/siwe";
import * as siwe from "../../../utils/siwe";
import { OwnershipTransferService } from "./OwnershipTransferService";

// The service imports `db` from the infra barrel and now runs the
// owner-flip + transfer-delete inside `db.transaction`. Run the callback
// with a throwaway tx handle; the repo methods are mocked and ignore it.
vi.mock("@backend-infrastructure", () => ({
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

const OWNER_WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const NEW_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const STRANGER_WALLET = "0xccccccccccccccccccccccccccccccccccccccc" as Address;

const OWNER_ACCOUNT = "11111111-1111-4111-8111-111111111111";
const NEW_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const STRANGER_ACCOUNT = "33333333-3333-4333-8333-333333333333";

const MERCHANT_ID = "merchant-123";

let mockSiweResult: SiweVerifyResult = {
    valid: true,
    wallet: OWNER_WALLET,
    nonce: undefined,
};

function makeService(
    opts: { ownerWallet?: Address | null; ownerAccountId?: string | null } = {}
) {
    const merchant = {
        id: MERCHANT_ID,
        ownerWallet:
            opts.ownerWallet === undefined ? OWNER_WALLET : opts.ownerWallet,
        ownerAccountId: opts.ownerAccountId ?? null,
    };

    const merchantRepo = {
        findById: vi.fn((id: string) =>
            Promise.resolve(id === MERCHANT_ID ? (merchant as never) : null)
        ),
        updateOwner: vi.fn(() => Promise.resolve(merchant as never)),
        invalidateCachesById: vi.fn(),
    };

    let activeTransfer: Record<string, unknown> | null = null;
    const transferRepo = {
        findActiveByMerchant: vi.fn(() => Promise.resolve(activeTransfer)),
        create: vi.fn((params: Record<string, unknown>) => {
            activeTransfer = {
                ...params,
                initiatedAt: new Date(),
                expiresAt: new Date(Date.now() + 1000),
            };
            return Promise.resolve(activeTransfer as never);
        }),
        delete: vi.fn(() => {
            const had = activeTransfer !== null;
            activeTransfer = null;
            return Promise.resolve(had);
        }),
        setActiveTransfer: (t: Record<string, unknown> | null) => {
            activeTransfer = t;
        },
    };

    const service = new OwnershipTransferService(
        merchantRepo as never,
        transferRepo as never
    );

    return { service, merchantRepo, transferRepo };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockSiweResult = { valid: true, wallet: OWNER_WALLET, nonce: undefined };
    // Spy on the shared SIWE core (deep-imported from `utils/siwe.ts`, never
    // through the `@backend-utils` barrel \u2014 see the import comment in
    // `OwnershipTransferService.ts`) so tests exercise the transfer logic,
    // not the on-chain signature check. Re-applied every test since
    // `afterEach` restores it.
    vi.spyOn(siwe, "verifySiweSignatureWithStatement").mockImplementation(() =>
        Promise.resolve(mockSiweResult)
    );
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("OwnershipTransferService.initiateTransfer", () => {
    it("wallet owner: initiates with a valid SIWE proof to a wallet target", async () => {
        const { service, transferRepo } = makeService({
            ownerWallet: OWNER_WALLET,
        });
        mockSiweResult = {
            valid: true,
            wallet: OWNER_WALLET,
            nonce: undefined,
        };

        await service.initiateTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: OWNER_WALLET, accountId: null },
            target: { wallet: NEW_WALLET },
            siweProof: { message: "msg", signature: "0xsig" as Address },
            requestOrigin: "https://business.frak.id",
        });

        expect(transferRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                merchantId: MERCHANT_ID,
                fromWallet: OWNER_WALLET,
                toWallet: NEW_WALLET,
                toAccountId: null,
            })
        );
    });

    it("wallet owner: rejects without a SIWE proof", async () => {
        const { service } = makeService({ ownerWallet: OWNER_WALLET });

        await expect(
            service.initiateTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: OWNER_WALLET, accountId: null },
                target: { wallet: NEW_WALLET },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });

    it("wallet owner: rejects when the SIWE signature is from a different wallet", async () => {
        const { service } = makeService({ ownerWallet: OWNER_WALLET });
        mockSiweResult = {
            valid: true,
            wallet: STRANGER_WALLET,
            nonce: undefined,
        };

        await expect(
            service.initiateTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: OWNER_WALLET, accountId: null },
                target: { wallet: NEW_WALLET },
                siweProof: { message: "msg", signature: "0xsig" as Address },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });

    it("walletless owner (§7.5): initiates via session identity alone, no SIWE proof needed", async () => {
        const { service, transferRepo } = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });

        await service.initiateTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: null, accountId: OWNER_ACCOUNT },
            target: { accountId: NEW_ACCOUNT },
            requestOrigin: "https://business.frak.id",
        });

        expect(transferRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                merchantId: MERCHANT_ID,
                fromAccountId: OWNER_ACCOUNT,
                toAccountId: NEW_ACCOUNT,
                toWallet: null,
            })
        );
    });

    it("walletless owner: rejects a caller whose account does not match the owner account", async () => {
        const { service } = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });

        await expect(
            service.initiateTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: null, accountId: STRANGER_ACCOUNT },
                target: { accountId: NEW_ACCOUNT },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });

    it("walletless owner: rejects an unauthenticated (no account) caller", async () => {
        const { service } = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });

        await expect(
            service.initiateTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: null, accountId: null },
                target: { accountId: NEW_ACCOUNT },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });

    it("rejects transferring a wallet-owned merchant to its own current owner wallet", async () => {
        const { service } = makeService({ ownerWallet: OWNER_WALLET });

        await expect(
            service.initiateTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: OWNER_WALLET, accountId: null },
                target: { wallet: OWNER_WALLET },
                siweProof: { message: "msg", signature: "0xsig" as Address },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });
});

describe("OwnershipTransferService.acceptTransfer", () => {
    it("wallet target: accepts with a valid SIWE proof and updates the wallet owner", async () => {
        const { service, transferRepo, merchantRepo } = makeService({
            ownerWallet: OWNER_WALLET,
        });
        transferRepo.setActiveTransfer({
            merchantId: MERCHANT_ID,
            fromWallet: OWNER_WALLET,
            fromAccountId: null,
            toWallet: NEW_WALLET,
            toAccountId: null,
        });
        mockSiweResult = { valid: true, wallet: NEW_WALLET, nonce: undefined };

        await service.acceptTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: NEW_WALLET, accountId: null },
            siweProof: { message: "msg", signature: "0xsig" as Address },
            requestOrigin: "https://business.frak.id",
        });

        expect(merchantRepo.updateOwner).toHaveBeenCalledWith(
            MERCHANT_ID,
            { wallet: NEW_WALLET },
            expect.anything()
        );
    });

    it("account target (§7.5): accepts via the target account's own session, no SIWE proof needed", async () => {
        const { service, transferRepo, merchantRepo } = makeService();
        transferRepo.setActiveTransfer({
            merchantId: MERCHANT_ID,
            fromWallet: OWNER_WALLET,
            fromAccountId: null,
            toWallet: null,
            toAccountId: NEW_ACCOUNT,
        });

        await service.acceptTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: null, accountId: NEW_ACCOUNT },
            requestOrigin: "https://business.frak.id",
        });

        expect(merchantRepo.updateOwner).toHaveBeenCalledWith(
            MERCHANT_ID,
            { accountId: NEW_ACCOUNT },
            expect.anything()
        );
    });

    it("account target: rejects a caller whose account is not the designated target", async () => {
        const { service, transferRepo, merchantRepo } = makeService();
        transferRepo.setActiveTransfer({
            merchantId: MERCHANT_ID,
            fromWallet: OWNER_WALLET,
            fromAccountId: null,
            toWallet: null,
            toAccountId: NEW_ACCOUNT,
        });

        await expect(
            service.acceptTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: null, accountId: STRANGER_ACCOUNT },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
        expect(merchantRepo.updateOwner).not.toHaveBeenCalled();
    });

    it("rejects when there is no active transfer", async () => {
        const { service } = makeService();

        await expect(
            service.acceptTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: null, accountId: NEW_ACCOUNT },
                requestOrigin: "https://business.frak.id",
            })
        ).rejects.toThrow();
    });
});

describe("OwnershipTransferService.cancelTransfer", () => {
    it("allows the wallet owner to cancel", async () => {
        const { service, transferRepo } = makeService({
            ownerWallet: OWNER_WALLET,
        });
        transferRepo.setActiveTransfer({ merchantId: MERCHANT_ID });

        await service.cancelTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: OWNER_WALLET, accountId: null },
        });
        expect(transferRepo.delete).toHaveBeenCalledWith(MERCHANT_ID);
    });

    it("allows the walletless (account) owner to cancel", async () => {
        const { service, transferRepo } = makeService({
            ownerWallet: null,
            ownerAccountId: OWNER_ACCOUNT,
        });
        transferRepo.setActiveTransfer({ merchantId: MERCHANT_ID });

        await service.cancelTransfer({
            merchantId: MERCHANT_ID,
            actor: { wallet: null, accountId: OWNER_ACCOUNT },
        });
        expect(transferRepo.delete).toHaveBeenCalledWith(MERCHANT_ID);
    });

    it("rejects a non-owner", async () => {
        const { service } = makeService({ ownerWallet: OWNER_WALLET });

        await expect(
            service.cancelTransfer({
                merchantId: MERCHANT_ID,
                actor: { wallet: STRANGER_WALLET, accountId: null },
            })
        ).rejects.toThrow();
    });
});
