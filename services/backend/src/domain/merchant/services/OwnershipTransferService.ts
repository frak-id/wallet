import { db } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { type Address, type Hex, isAddressEqual } from "viem";
// Deep import (bypasses the `@backend-utils` barrel) — see the comment in
// `api/business/auth/common.ts` for why `siwe.ts` can't be re-exported there.
import { verifySiweSignatureWithStatement } from "../../../utils/siwe";
import type { MerchantOwnershipTransferRepository } from "../repositories/MerchantOwnershipTransferRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

/**
 * The caller's own identity for the transfer flow — mirrors
 * `MerchantAuthorizationService.MerchantIdentity` (wallet and/or account).
 */
export type TransferActor = {
    wallet: Address | null;
    accountId: string | null;
};

/**
 * Who the merchant is being transferred to. Exactly one axis is set — a
 * wallet (verified via a fresh SIWE signature from that wallet, existing
 * flow) or an existing business account (verified by that account's own
 * step-up-verified session accepting the transfer, §7.5).
 */
export type TransferTarget =
    | { wallet: Address; accountId?: never }
    | { wallet?: never; accountId: string };

export class OwnershipTransferService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly transferRepository: MerchantOwnershipTransferRepository
    ) {}

    /**
     * Initiate a transfer. The current owner proves ownership per their own
     * identity axis (§7.5):
     *  - wallet owner: a fresh SIWE signature over the initiate statement.
     *  - walletless owner: the caller's step-up-verified session IS the
     *    proof (enforced by `requireStepUp` at the route level) — no SIWE
     *    message needed, `siweProof` is omitted.
     */
    async initiateTransfer(params: {
        merchantId: string;
        actor: TransferActor;
        target: TransferTarget;
        siweProof?: { message: string; signature: Hex };
        requestOrigin: string;
    }): Promise<void> {
        const merchant = await this.merchantRepository.findById(
            params.merchantId
        );
        if (!merchant) {
            throw HttpError.notFound(
                "MERCHANT_NOT_FOUND",
                "Merchant not found"
            );
        }

        await this.assertIsOwner(merchant, params.actor, params);

        if (
            params.target.wallet &&
            merchant.ownerWallet &&
            isAddressEqual(params.target.wallet, merchant.ownerWallet)
        ) {
            throw HttpError.conflict(
                "SAME_OWNER",
                "Cannot transfer to the same owner"
            );
        }
        if (
            params.target.accountId &&
            params.target.accountId === merchant.ownerAccountId
        ) {
            throw HttpError.conflict(
                "SAME_OWNER",
                "Cannot transfer to the same owner"
            );
        }

        await this.transferRepository.create({
            merchantId: params.merchantId,
            fromWallet: merchant.ownerWallet,
            fromAccountId: merchant.ownerAccountId,
            toWallet: params.target.wallet ?? null,
            toAccountId: params.target.accountId ?? null,
        });
    }

    /**
     * Verifies `params.actor` is the current owner. Wallet owners must
     * supply a fresh SIWE proof over `buildInitiateStatement`; walletless
     * owners are trusted on session identity alone (the route's
     * `requireStepUp` guard already enforced freshness).
     */
    private async assertIsOwner(
        merchant: {
            ownerWallet: Address | null;
            ownerAccountId: string | null;
        },
        actor: TransferActor,
        params: {
            merchantId: string;
            target: TransferTarget;
            siweProof?: { message: string; signature: Hex };
            requestOrigin: string;
        }
    ): Promise<void> {
        if (merchant.ownerWallet) {
            if (!params.siweProof) {
                throw HttpError.forbidden(
                    "SIWE_REQUIRED",
                    "A wallet-owned merchant requires a fresh SIWE signature to initiate transfer"
                );
            }
            const statement = this.buildInitiateStatement(
                params.merchantId,
                params.target
            );
            const result = await verifySiweSignatureWithStatement({
                message: params.siweProof.message,
                signature: params.siweProof.signature,
                requestOrigin: params.requestOrigin,
                expectedStatements: [statement],
            });
            if (!result.valid) {
                throw HttpError.badRequest("SIWE_INVALID", result.error);
            }
            if (!isAddressEqual(result.wallet, merchant.ownerWallet)) {
                throw HttpError.forbidden(
                    "OWNER_ONLY",
                    "Only the current owner can initiate transfer"
                );
            }
            return;
        }

        // Walletless owner (§7.5): the step-up-verified session is the
        // proof — no SIWE message to check.
        if (!actor.accountId || actor.accountId !== merchant.ownerAccountId) {
            throw HttpError.forbidden(
                "OWNER_ONLY",
                "Only the current owner can initiate transfer"
            );
        }
    }

    /**
     * Accept a pending transfer. The designated target proves identity per
     * their own axis:
     *  - wallet target: a fresh SIWE signature over the accept statement.
     *  - account target: the target's own step-up-verified session IS the
     *    proof (§7.5) — no SIWE message needed.
     */
    async acceptTransfer(params: {
        merchantId: string;
        actor: TransferActor;
        siweProof?: { message: string; signature: Hex };
        requestOrigin: string;
    }): Promise<void> {
        const transfer = await this.transferRepository.findActiveByMerchant(
            params.merchantId
        );
        if (!transfer) {
            throw HttpError.notFound(
                "NO_ACTIVE_TRANSFER",
                "No active transfer found for this merchant"
            );
        }

        if (transfer.toWallet) {
            if (!params.siweProof) {
                throw HttpError.forbidden(
                    "SIWE_REQUIRED",
                    "A wallet transfer target requires a fresh SIWE signature to accept"
                );
            }
            const result = await verifySiweSignatureWithStatement({
                message: params.siweProof.message,
                signature: params.siweProof.signature,
                requestOrigin: params.requestOrigin,
                expectedStatements: [
                    this.buildAcceptStatement(params.merchantId),
                ],
            });
            if (!result.valid) {
                throw HttpError.badRequest("SIWE_INVALID", result.error);
            }
            if (!isAddressEqual(result.wallet, transfer.toWallet)) {
                throw HttpError.forbidden(
                    "NEW_OWNER_ONLY",
                    "Only the designated new owner can accept transfer"
                );
            }
        } else if (transfer.toAccountId) {
            if (params.actor.accountId !== transfer.toAccountId) {
                throw HttpError.forbidden(
                    "NEW_OWNER_ONLY",
                    "Only the designated new owner can accept transfer"
                );
            }
        } else {
            // Unreachable given the create()-time CHECK constraint, but
            // keeps the branch exhaustive rather than silently no-op-ing.
            throw HttpError.internal(
                "INVALID_TRANSFER",
                "Pending transfer has no target identity"
            );
        }

        const newOwner = transfer.toWallet
            ? { wallet: transfer.toWallet }
            : { accountId: transfer.toAccountId as string };

        // Flip the owner and drop the transfer row atomically — a crash
        // between the two writes would otherwise leave the owner already
        // changed while the transfer still reads as pending. `tx` defers
        // the owner-cache invalidation (see `applyUpdate`) until after this
        // commits, same outer-tx contract as `IdentityMergeService`.
        await db.transaction(async (tx) => {
            await this.merchantRepository.updateOwner(
                params.merchantId,
                newOwner,
                tx
            );
            await this.transferRepository.delete(params.merchantId, tx);
        });
        this.merchantRepository.invalidateCachesById(params.merchantId);
    }

    async cancelTransfer(params: {
        merchantId: string;
        actor: TransferActor;
    }): Promise<void> {
        const merchant = await this.merchantRepository.findById(
            params.merchantId
        );
        if (!merchant) {
            throw HttpError.notFound(
                "MERCHANT_NOT_FOUND",
                "Merchant not found"
            );
        }

        const isOwner =
            (params.actor.wallet &&
                merchant.ownerWallet &&
                isAddressEqual(params.actor.wallet, merchant.ownerWallet)) ||
            (params.actor.accountId &&
                params.actor.accountId === merchant.ownerAccountId);
        if (!isOwner) {
            throw HttpError.forbidden(
                "OWNER_ONLY",
                "Only the current owner can cancel transfer"
            );
        }

        const deleted = await this.transferRepository.delete(params.merchantId);
        if (!deleted) {
            throw HttpError.notFound(
                "NO_PENDING_TRANSFER",
                "No pending transfer to cancel"
            );
        }
    }

    async getPendingTransfer(merchantId: string) {
        return this.transferRepository.findActiveByMerchant(merchantId);
    }

    buildInitiateStatement(merchantId: string, target: TransferTarget): string {
        const targetLabel = target.wallet ?? target.accountId;
        return `Transfer ownership of merchant ${merchantId} to ${targetLabel}`;
    }

    buildAcceptStatement(merchantId: string): string {
        return `Accept ownership of merchant ${merchantId}`;
    }
}
