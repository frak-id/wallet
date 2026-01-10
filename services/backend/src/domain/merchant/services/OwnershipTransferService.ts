import { viemClient } from "@backend-infrastructure";
import { type Address, type Hex, isAddressEqual } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import type { MerchantOwnershipTransferRepository } from "../repositories/MerchantOwnershipTransferRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

export type TransferResult =
    | { success: true }
    | { success: false; error: string };

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
    }): Promise<TransferResult> {
        const merchant = await this.merchantRepository.findById(
            params.merchantId
        );
        if (!merchant) {
            return { success: false, error: "Merchant not found" };
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
            return { success: false, error: siweResult.error };
        }

        if (!isAddressEqual(siweResult.wallet, merchant.ownerWallet)) {
            return {
                success: false,
                error: "Only the current owner can initiate transfer",
            };
        }

        if (isAddressEqual(params.toWallet, merchant.ownerWallet)) {
            return {
                success: false,
                error: "Cannot transfer to the same owner",
            };
        }

        await this.transferRepository.create({
            merchantId: params.merchantId,
            fromWallet: merchant.ownerWallet,
            toWallet: params.toWallet,
        });

        return { success: true };
    }

    async acceptTransfer(params: {
        merchantId: string;
        message: string;
        signature: Hex;
        requestOrigin: string;
    }): Promise<TransferResult> {
        const transfer = await this.transferRepository.findActiveByMerchant(
            params.merchantId
        );
        if (!transfer) {
            return {
                success: false,
                error: "No active transfer found for this merchant",
            };
        }

        const siweResult = await this.verifySiweMessage({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            expectedStatement: this.buildAcceptStatement(params.merchantId),
        });
        if (!siweResult.valid) {
            return { success: false, error: siweResult.error };
        }

        if (!isAddressEqual(siweResult.wallet, transfer.toWallet)) {
            return {
                success: false,
                error: "Only the designated new owner can accept transfer",
            };
        }

        await this.merchantRepository.updateOwner(
            params.merchantId,
            transfer.toWallet
        );
        await this.transferRepository.delete(params.merchantId);

        return { success: true };
    }

    async cancelTransfer(params: {
        merchantId: string;
        wallet: Address;
    }): Promise<TransferResult> {
        const merchant = await this.merchantRepository.findById(
            params.merchantId
        );
        if (!merchant) {
            return { success: false, error: "Merchant not found" };
        }

        if (!isAddressEqual(params.wallet, merchant.ownerWallet)) {
            return {
                success: false,
                error: "Only the current owner can cancel transfer",
            };
        }

        const deleted = await this.transferRepository.delete(params.merchantId);
        if (!deleted) {
            return { success: false, error: "No pending transfer to cancel" };
        }

        return { success: true };
    }

    async getPendingTransfer(merchantId: string) {
        return this.transferRepository.findActiveByMerchant(merchantId);
    }

    async getPendingTransfersForWallet(wallet: Address) {
        return this.transferRepository.findPendingForWallet(wallet);
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
