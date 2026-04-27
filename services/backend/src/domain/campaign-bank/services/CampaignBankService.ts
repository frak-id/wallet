import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { MerchantRepository } from "../../merchant/repositories/MerchantRepository";
import type { CampaignBankRepository } from "../repositories/CampaignBankRepository";

export class CampaignBankService {
    constructor(
        readonly campaignBankRepository: CampaignBankRepository,
        readonly merchantRepository: MerchantRepository
    ) {}

    async deployAndSetupBank(
        merchantId: string
    ): Promise<{ bankAddress: Address }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            throw HttpError.notFound(
                "MERCHANT_NOT_FOUND",
                "Merchant not found"
            );
        }

        if (merchant.bankAddress) {
            return { bankAddress: merchant.bankAddress };
        }

        try {
            const { bankAddress } =
                await this.campaignBankRepository.deployBank(merchantId);

            await this.merchantRepository.updateBankAddress(
                merchantId,
                bankAddress
            );

            await this.campaignBankRepository.grantManagerRole(
                merchantId,
                bankAddress,
                merchant.ownerWallet
            );

            await this.campaignBankRepository.enableDistribution(bankAddress, {
                tokens: currentStablecoinsList,
            });

            log.info(
                {
                    merchantId,
                    bankAddress,
                    ownerWallet: merchant.ownerWallet,
                },
                "Campaign bank deployed and configured"
            );

            return { bankAddress };
        } catch (error) {
            log.error(
                {
                    merchantId,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to deploy campaign bank"
            );
            // Hide raw blockchain error from clients; the cause is logged above.
            throw HttpError.internal(
                "DEPLOY_BANK_FAILED",
                "Failed to deploy bank"
            );
        }
    }

    async syncBankRoles(
        merchantId: string
    ): Promise<{ rolesGranted: boolean; rolesRevoked: boolean }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            throw HttpError.notFound(
                "MERCHANT_NOT_FOUND",
                "Merchant not found"
            );
        }

        if (!merchant.bankAddress) {
            await this.deployAndSetupBank(merchantId);
            return { rolesGranted: true, rolesRevoked: false };
        }

        const hasRole = await this.campaignBankRepository.hasManagerRole(
            merchant.bankAddress,
            merchant.ownerWallet
        );

        if (hasRole) {
            return { rolesGranted: false, rolesRevoked: false };
        }

        try {
            await this.campaignBankRepository.grantManagerRole(
                merchantId,
                merchant.bankAddress,
                merchant.ownerWallet
            );

            log.info(
                {
                    merchantId,
                    bankAddress: merchant.bankAddress,
                    ownerWallet: merchant.ownerWallet,
                },
                "Manager role granted during sync"
            );

            return { rolesGranted: true, rolesRevoked: false };
        } catch (error) {
            log.error(
                {
                    merchantId,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to sync bank roles"
            );
            throw HttpError.internal(
                "SYNC_ROLES_FAILED",
                "Failed to sync roles"
            );
        }
    }

    async transferBankRoles(
        merchantId: string,
        fromWallet: Address,
        toWallet: Address
    ): Promise<{ rolesGranted: boolean; rolesRevoked: boolean }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            throw HttpError.notFound(
                "MERCHANT_NOT_FOUND",
                "Merchant not found"
            );
        }

        if (!merchant.bankAddress) {
            log.warn(
                { merchantId },
                "No bank address found during ownership transfer"
            );
            return { rolesGranted: false, rolesRevoked: false };
        }

        let rolesRevoked = false;
        let rolesGranted = false;

        try {
            const fromHasRole =
                await this.campaignBankRepository.hasManagerRole(
                    merchant.bankAddress,
                    fromWallet
                );

            if (fromHasRole) {
                await this.campaignBankRepository.revokeManagerRole(
                    merchantId,
                    merchant.bankAddress,
                    fromWallet
                );
                rolesRevoked = true;
            }

            const toHasRole = await this.campaignBankRepository.hasManagerRole(
                merchant.bankAddress,
                toWallet
            );

            if (!toHasRole) {
                await this.campaignBankRepository.grantManagerRole(
                    merchantId,
                    merchant.bankAddress,
                    toWallet
                );
                rolesGranted = true;
            }

            log.info(
                {
                    merchantId,
                    bankAddress: merchant.bankAddress,
                    fromWallet,
                    toWallet,
                    rolesRevoked,
                    rolesGranted,
                },
                "Bank roles transferred for ownership change"
            );

            return { rolesGranted, rolesRevoked };
        } catch (error) {
            log.error(
                {
                    merchantId,
                    fromWallet,
                    toWallet,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to transfer bank roles"
            );
            throw HttpError.internal(
                "TRANSFER_ROLES_FAILED",
                "Failed to transfer roles"
            );
        }
    }

    async getBankStatus(merchantId: string): Promise<{
        deployed: boolean;
        bankAddress: Address | null;
        ownerHasManagerRole: boolean;
    }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant?.bankAddress) {
            return {
                deployed: false,
                bankAddress: null,
                ownerHasManagerRole: false,
            };
        }
        const ownerHasManagerRole =
            await this.campaignBankRepository.hasManagerRole(
                merchant.bankAddress,
                merchant.ownerWallet
            );

        return {
            deployed: true,
            bankAddress: merchant.bankAddress,
            ownerHasManagerRole,
        };
    }
}
