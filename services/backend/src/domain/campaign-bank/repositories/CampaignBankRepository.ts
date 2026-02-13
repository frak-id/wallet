import { log, viemClient } from "@backend-infrastructure";
import { addresses } from "@frak-labs/app-essentials";
import {
    type Address,
    encodeFunctionData,
    type Hex,
    keccak256,
    maxUint256,
} from "viem";
import {
    readContract,
    sendTransaction,
    waitForTransactionReceipt,
} from "viem/actions";
import { adminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import { campaignBankAbi, campaignBankFactoryAbi } from "../abis";

const CAMPAIGN_BANK_MANAGER_ROLE = 1n;

type DeployBankResult = {
    bankAddress: Address;
    txHash: Hex;
    blockNumber: bigint;
};

type RoleOperationResult = {
    txHash: Hex;
    blockNumber: bigint;
};

export class CampaignBankRepository {
    private computeBankSalt(merchantId: string): Hex {
        return keccak256(`0x${Buffer.from(merchantId).toString("hex")}` as Hex);
    }

    async deployBank(merchantId: string): Promise<DeployBankResult> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: "bank-manager",
        });

        return mutex.runExclusive(async () => {
            const bankOwnerAccount =
                await adminWalletsRepository.getKeySpecificAccount({
                    key: "bank-manager",
                });

            const salt = this.computeBankSalt(merchantId);

            log.info(
                {
                    merchantId,
                    bankOwner: bankOwnerAccount.address,
                    salt,
                },
                "Deploying campaign bank"
            );

            const data = encodeFunctionData({
                abi: campaignBankFactoryAbi,
                functionName: "deployBank",
                args: [bankOwnerAccount.address, salt],
            });

            const txHash = await sendTransaction(viemClient, {
                account: bankOwnerAccount,
                to: addresses.campaignBankFactory,
                data,
                chain: viemClient.chain,
            });

            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 4,
            });

            const bankAddress = await this.predictBankAddress(merchantId);

            log.info(
                {
                    merchantId,
                    bankAddress,
                    txHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed,
                },
                "Campaign bank deployed successfully"
            );

            return {
                bankAddress,
                txHash,
                blockNumber: receipt.blockNumber,
            };
        });
    }

    async predictBankAddress(merchantId: string): Promise<Address> {
        const salt = this.computeBankSalt(merchantId);

        return readContract(viemClient, {
            address: addresses.campaignBankFactory,
            abi: campaignBankFactoryAbi,
            functionName: "predictBankAddress",
            args: [salt],
        });
    }

    async getRolesOf(bankAddress: Address, user: Address): Promise<bigint> {
        return readContract(viemClient, {
            address: bankAddress,
            abi: campaignBankAbi,
            functionName: "rolesOf",
            args: [user],
        });
    }

    async hasManagerRole(
        bankAddress: Address,
        user: Address
    ): Promise<boolean> {
        const roles = await this.getRolesOf(bankAddress, user);
        return (roles & CAMPAIGN_BANK_MANAGER_ROLE) !== 0n;
    }

    async grantManagerRole(
        merchantId: string,
        bankAddress: Address,
        user: Address
    ): Promise<RoleOperationResult> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: "bank-manager",
        });

        return mutex.runExclusive(async () => {
            const bankOwnerAccount =
                await adminWalletsRepository.getKeySpecificAccount({
                    key: "bank-manager",
                });

            log.info(
                {
                    merchantId,
                    bankAddress,
                    user,
                    role: CAMPAIGN_BANK_MANAGER_ROLE,
                },
                "Granting manager role on campaign bank"
            );

            const data = encodeFunctionData({
                abi: campaignBankAbi,
                functionName: "grantRoles",
                args: [user, CAMPAIGN_BANK_MANAGER_ROLE],
            });

            const txHash = await sendTransaction(viemClient, {
                account: bankOwnerAccount,
                to: bankAddress,
                data,
                chain: viemClient.chain,
            });

            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 2,
            });

            log.info(
                {
                    merchantId,
                    bankAddress,
                    user,
                    txHash,
                    blockNumber: receipt.blockNumber,
                },
                "Manager role granted successfully"
            );

            return {
                txHash,
                blockNumber: receipt.blockNumber,
            };
        });
    }

    async revokeManagerRole(
        merchantId: string,
        bankAddress: Address,
        user: Address
    ): Promise<RoleOperationResult> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: "bank-manager",
        });

        return mutex.runExclusive(async () => {
            const bankOwnerAccount =
                await adminWalletsRepository.getKeySpecificAccount({
                    key: "bank-manager",
                });

            log.info(
                {
                    merchantId,
                    bankAddress,
                    user,
                    role: CAMPAIGN_BANK_MANAGER_ROLE,
                },
                "Revoking manager role on campaign bank"
            );

            const data = encodeFunctionData({
                abi: campaignBankAbi,
                functionName: "revokeRoles",
                args: [user, CAMPAIGN_BANK_MANAGER_ROLE],
            });

            const txHash = await sendTransaction(viemClient, {
                account: bankOwnerAccount,
                to: bankAddress,
                data,
                chain: viemClient.chain,
            });

            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 4,
            });

            log.info(
                {
                    merchantId,
                    bankAddress,
                    user,
                    txHash,
                    blockNumber: receipt.blockNumber,
                },
                "Manager role revoked successfully"
            );

            return {
                txHash,
                blockNumber: receipt.blockNumber,
            };
        });
    }

    async enableDistribution(
        bankAddress: Address,
        options?: { tokens?: Address[] }
    ): Promise<void> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: "bank-manager",
        });

        await mutex.runExclusive(async () => {
            const bankOwnerAccount =
                await adminWalletsRepository.getKeySpecificAccount({
                    key: "bank-manager",
                });

            const setOpenData = encodeFunctionData({
                abi: campaignBankAbi,
                functionName: "setOpen",
                args: [true],
            });

            const setOpenTxHash = await sendTransaction(viemClient, {
                account: bankOwnerAccount,
                to: bankAddress,
                data: setOpenData,
                chain: viemClient.chain,
            });

            await waitForTransactionReceipt(viemClient, {
                hash: setOpenTxHash,
                confirmations: 2,
            });

            log.info(
                { bankAddress, txHash: setOpenTxHash },
                "Campaign bank opened for distribution"
            );

            const tokens = options?.tokens;
            if (tokens && tokens.length > 0) {
                const updateAllowancesData = encodeFunctionData({
                    abi: campaignBankAbi,
                    functionName: "updateAllowances",
                    args: [tokens, tokens.map(() => maxUint256)],
                });

                const allowanceTxHash = await sendTransaction(viemClient, {
                    account: bankOwnerAccount,
                    to: bankAddress,
                    data: updateAllowancesData,
                    chain: viemClient.chain,
                });

                await waitForTransactionReceipt(viemClient, {
                    hash: allowanceTxHash,
                    confirmations: 2,
                });

                log.info(
                    {
                        bankAddress,
                        tokens,
                        txHash: allowanceTxHash,
                    },
                    "Campaign bank allowances set to max"
                );
            }
        });
    }
}
