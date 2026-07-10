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

            // Walletless owner (§4.10): the bank still deploys via the
            // backend key; the MANAGER role grant is deferred until a wallet
            // is linked (then `/bank/sync` grants it).
            if (merchant.ownerWallet) {
                await this.campaignBankRepository.grantManagerRole(
                    merchantId,
                    bankAddress,
                    merchant.ownerWallet
                );
            }

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

        // Walletless owner — nothing to sync until a wallet is linked.
        if (!merchant.ownerWallet) {
            return { rolesGranted: false, rolesRevoked: false };
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

    /**
     * Transfer onchain bank-manager role between two wallets. Either side
     * may be `null` when the corresponding owner (previous or new) is
     * walletless (§7.5) — that half of the role change is simply skipped;
     * a later wallet link + `/bank/sync` catches up.
     */
    async transferBankRoles(
        merchantId: string,
        fromWallet: Address | null,
        toWallet: Address | null
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
                fromWallet &&
                (await this.campaignBankRepository.hasManagerRole(
                    merchant.bankAddress,
                    fromWallet
                ));

            if (fromWallet && fromHasRole) {
                await this.campaignBankRepository.revokeManagerRole(
                    merchantId,
                    merchant.bankAddress,
                    fromWallet
                );
                rolesRevoked = true;
            }

            const toHasRole =
                toWallet &&
                (await this.campaignBankRepository.hasManagerRole(
                    merchant.bankAddress,
                    toWallet
                ));

            if (toWallet && !toHasRole) {
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
        /**
         * "no_wallet" — walletless owner: no wallet to hold the MANAGER role
         * (§4.9); the UI shows the wallet-link CTA instead of a role error.
         */
        managerRole: "granted" | "missing" | "no_wallet";
    }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant?.bankAddress) {
            return {
                deployed: false,
                bankAddress: null,
                ownerHasManagerRole: false,
                managerRole: merchant?.ownerWallet ? "missing" : "no_wallet",
            };
        }

        if (!merchant.ownerWallet) {
            return {
                deployed: true,
                bankAddress: merchant.bankAddress,
                ownerHasManagerRole: false,
                managerRole: "no_wallet",
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
            managerRole: ownerHasManagerRole ? "granted" : "missing",
        };
    }
}
