import { log } from "@backend-infrastructure";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { MerchantRepository } from "../../merchant/repositories/MerchantRepository";
import type { CampaignBankRepository } from "../repositories/CampaignBankRepository";
import type { DistributionStatus } from "../schemas";

type DeployAndSetupResult =
    | { success: true; bankAddress: Address }
    | { success: false; error: string };

type SyncRolesResult =
    | { success: true; rolesGranted: boolean; rolesRevoked: boolean }
    | { success: false; error: string };

export class CampaignBankService {
    constructor(
        readonly campaignBankRepository: CampaignBankRepository,
        readonly merchantRepository: MerchantRepository
    ) {}

    async deployAndSetupBank(
        merchantId: string
    ): Promise<DeployAndSetupResult> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            return { success: false, error: "Merchant not found" };
        }

        if (merchant.bankAddress) {
            return { success: true, bankAddress: merchant.bankAddress };
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

            return { success: true, bankAddress };
        } catch (error) {
            log.error(
                {
                    merchantId,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to deploy campaign bank"
            );
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to deploy bank",
            };
        }
    }

    async syncBankRoles(merchantId: string): Promise<SyncRolesResult> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            return { success: false, error: "Merchant not found" };
        }

        if (!merchant.bankAddress) {
            const deployResult = await this.deployAndSetupBank(merchantId);
            if (!deployResult.success) {
                return { success: false, error: deployResult.error };
            }
            return { success: true, rolesGranted: true, rolesRevoked: false };
        }

        const hasRole = await this.campaignBankRepository.hasManagerRole(
            merchant.bankAddress,
            merchant.ownerWallet
        );

        if (hasRole) {
            return { success: true, rolesGranted: false, rolesRevoked: false };
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

            return { success: true, rolesGranted: true, rolesRevoked: false };
        } catch (error) {
            log.error(
                {
                    merchantId,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to sync bank roles"
            );
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to sync roles",
            };
        }
    }

    async transferBankRoles(
        merchantId: string,
        fromWallet: Address,
        toWallet: Address
    ): Promise<SyncRolesResult> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant) {
            return { success: false, error: "Merchant not found" };
        }

        if (!merchant.bankAddress) {
            log.warn(
                { merchantId },
                "No bank address found during ownership transfer"
            );
            return { success: true, rolesGranted: false, rolesRevoked: false };
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

            return { success: true, rolesGranted, rolesRevoked };
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
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to transfer roles",
            };
        }
    }

    async getBankStatus(merchantId: string): Promise<{
        deployed: boolean;
        bankAddress: Address | null;
        ownerHasManagerRole: boolean;
        distributionStatus: DistributionStatus;
    }> {
        const merchant = await this.merchantRepository.findById(merchantId);
        if (!merchant?.bankAddress) {
            return {
                deployed: false,
                bankAddress: null,
                ownerHasManagerRole: false,
                distributionStatus: "not_deployed",
            };
        }

        const [ownerHasManagerRole, onChainState] = await Promise.all([
            this.campaignBankRepository.hasManagerRole(
                merchant.bankAddress,
                merchant.ownerWallet
            ),
            this.campaignBankRepository.getBankOnChainState(
                merchant.bankAddress,
                currentStablecoinsList
            ),
        ]);

        return {
            deployed: true,
            bankAddress: merchant.bankAddress,
            ownerHasManagerRole,
            distributionStatus:
                this.computeDistributionStatusFromOnChainState(onChainState),
        };
    }

    private computeDistributionStatusFromOnChainState(onChainState: {
        isOpen: boolean;
        balances: Map<Address, bigint>;
        allowances: Map<Address, bigint>;
    }): DistributionStatus {
        if (!onChainState.isOpen) {
            return "paused";
        }

        let totalBalance = 0n;
        for (const balance of onChainState.balances.values()) {
            totalBalance += balance;
        }

        if (totalBalance === 0n) {
            return "depleted";
        }

        for (const [token, balance] of onChainState.balances.entries()) {
            if (balance <= 0n) {
                continue;
            }

            const allowance = onChainState.allowances.get(token) ?? 0n;
            if (allowance === 0n) {
                return "low_funds";
            }
        }

        return "distributing";
    }
}
