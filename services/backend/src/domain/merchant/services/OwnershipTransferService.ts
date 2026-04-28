import { viemClient } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { type Address, type Hex, isAddressEqual } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import type { MerchantOwnershipTransferRepository } from "../repositories/MerchantOwnershipTransferRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

export class OwnershipTransferService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly transferRepository: MerchantOwnershipTransferRepository
    ) {}

    async initiateTransfer(params: {
        merchantId: string;
        message: string;
        signature: Hex;
        toWallet: Address;
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

        const siweResult = await this.verifySiweMessage({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            expectedStatement: this.buildInitiateStatement(
                params.merchantId,
                params.toWallet
            ),
        });
        if (!siweResult.valid) {
            throw HttpError.badRequest("SIWE_INVALID", siweResult.error);
        }

        if (!isAddressEqual(siweResult.wallet, merchant.ownerWallet)) {
            throw HttpError.forbidden(
                "OWNER_ONLY",
                "Only the current owner can initiate transfer"
            );
        }

        if (isAddressEqual(params.toWallet, merchant.ownerWallet)) {
            throw HttpError.conflict(
                "SAME_OWNER",
                "Cannot transfer to the same owner"
            );
        }

        await this.transferRepository.create({
            merchantId: params.merchantId,
            fromWallet: merchant.ownerWallet,
            toWallet: params.toWallet,
        });
    }

    async acceptTransfer(params: {
        merchantId: string;
        message: string;
        signature: Hex;
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

        const siweResult = await this.verifySiweMessage({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            expectedStatement: this.buildAcceptStatement(params.merchantId),
        });
        if (!siweResult.valid) {
            throw HttpError.badRequest("SIWE_INVALID", siweResult.error);
        }

        if (!isAddressEqual(siweResult.wallet, transfer.toWallet)) {
            throw HttpError.forbidden(
                "NEW_OWNER_ONLY",
                "Only the designated new owner can accept transfer"
            );
        }

        await this.merchantRepository.updateOwner(
            params.merchantId,
            transfer.toWallet
        );
        await this.transferRepository.delete(params.merchantId);
    }

    async cancelTransfer(params: {
        merchantId: string;
        wallet: Address;
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

        if (!isAddressEqual(params.wallet, merchant.ownerWallet)) {
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

    private async verifySiweMessage(params: {
        message: string;
        signature: Hex;
        requestOrigin: string;
        expectedStatement: string;
    }): Promise<
        { valid: true; wallet: Address } | { valid: false; error: string }
    > {
        const siweMessage = parseSiweMessage(params.message);
        if (!siweMessage?.address) {
            return { valid: false, error: "Invalid SIWE message format" };
        }

        const originHost = new URL(params.requestOrigin).host;
        const isValid = validateSiweMessage({
            message: siweMessage,
            domain: originHost,
        });
        if (!isValid) {
            return { valid: false, error: "SIWE message validation failed" };
        }

        if (siweMessage.statement !== params.expectedStatement) {
            return {
                valid: false,
                error: "SIWE statement does not match expected statement",
            };
        }

        const isValidSignature = await verifyMessage(viemClient, {
            message: params.message,
            signature: params.signature,
            address: siweMessage.address,
        });
        if (!isValidSignature) {
            return { valid: false, error: "Invalid signature" };
        }

        return { valid: true, wallet: siweMessage.address };
    }

    buildInitiateStatement(merchantId: string, toWallet: Address): string {
        return `Transfer ownership of merchant ${merchantId} to ${toWallet}`;
    }

    buildAcceptStatement(merchantId: string): string {
        return `Accept ownership of merchant ${merchantId}`;
    }
}
