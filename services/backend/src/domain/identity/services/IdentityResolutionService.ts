import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import {
    type ResolveOp,
    type RewardsHubRepository,
    rewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { encodeUserId } from "../../rewards/types";
import { IdentityRepository } from "../repositories/IdentityRepository";

type IdentityType = "anonymous_fingerprint" | "merchant_customer" | "wallet";

export class IdentityResolutionService {
    private repository: IdentityRepository;
    private rewardsHub: RewardsHubRepository;

    constructor(
        repository?: IdentityRepository,
        rewardsHub?: RewardsHubRepository
    ) {
        this.repository = repository ?? new IdentityRepository();
        this.rewardsHub = rewardsHub ?? rewardsHubRepository;
    }

    async resolveAnonymousId(params: {
        anonId: string;
        merchantId: string;
    }): Promise<{ identityGroupId: string; isNew: boolean }> {
        const existingGroup = await this.repository.findGroupByIdentity({
            type: "anonymous_fingerprint",
            value: params.anonId,
            merchantId: params.merchantId,
        });

        if (existingGroup) {
            return { identityGroupId: existingGroup.id, isNew: false };
        }

        const newGroup = await this.repository.createGroup();
        await this.repository.addNode({
            groupId: newGroup.id,
            type: "anonymous_fingerprint",
            value: params.anonId,
            merchantId: params.merchantId,
        });

        log.debug(
            { groupId: newGroup.id, anonId: params.anonId },
            "Created new identity group for anonymous user"
        );

        return { identityGroupId: newGroup.id, isNew: true };
    }

    async linkMerchantCustomer(params: {
        identityGroupId: string;
        merchantId: string;
        customerId: string;
        customerEmail?: string;
    }): Promise<void> {
        const existingGroup = await this.repository.findGroupByIdentity({
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
        });

        if (existingGroup && existingGroup.id !== params.identityGroupId) {
            await this.mergeGroups({
                anchorGroupId: existingGroup.walletAddress
                    ? existingGroup.id
                    : params.identityGroupId,
                mergingGroupId: existingGroup.walletAddress
                    ? params.identityGroupId
                    : existingGroup.id,
            });
            return;
        }

        await this.repository.addNode({
            groupId: params.identityGroupId,
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
        });

        log.debug(
            {
                groupId: params.identityGroupId,
                customerId: params.customerId,
            },
            "Linked merchant customer to identity group"
        );
    }

    async connectWallet(params: {
        wallet: Address;
        clientId?: string;
        merchantId?: string;
    }): Promise<{
        identityGroupId: string;
        merged: boolean;
        mergedGroupIds: string[];
    }> {
        const groupsToResolve: string[] = [];

        const walletGroup = await this.repository.findGroupByWallet(
            params.wallet
        );

        let clientGroup: { id: string; walletAddress: Address | null } | null =
            null;
        if (params.clientId && params.merchantId) {
            clientGroup = await this.repository.findGroupByIdentity({
                type: "anonymous_fingerprint",
                value: params.clientId,
                merchantId: params.merchantId,
            });
        }

        let finalGroupId: string;

        if (walletGroup) {
            finalGroupId = walletGroup.id;

            if (clientGroup && clientGroup.id !== walletGroup.id) {
                await this.mergeGroups({
                    anchorGroupId: walletGroup.id,
                    mergingGroupId: clientGroup.id,
                });
                groupsToResolve.push(clientGroup.id);

                log.debug(
                    {
                        walletGroupId: walletGroup.id,
                        clientGroupId: clientGroup.id,
                        wallet: params.wallet,
                    },
                    "Merged clientId group into existing wallet group"
                );
            }
        } else if (clientGroup) {
            finalGroupId = clientGroup.id;
            groupsToResolve.push(clientGroup.id);

            await this.repository.updateGroupWallet(
                clientGroup.id,
                params.wallet
            );
            await this.repository.addNode({
                groupId: clientGroup.id,
                type: "wallet",
                value: params.wallet,
            });

            log.debug(
                {
                    groupId: clientGroup.id,
                    wallet: params.wallet,
                },
                "Connected wallet to existing clientId group"
            );
        } else {
            const newGroup = await this.repository.createGroup(params.wallet);
            finalGroupId = newGroup.id;

            await this.repository.addNode({
                groupId: newGroup.id,
                type: "wallet",
                value: params.wallet,
            });

            if (params.clientId && params.merchantId) {
                await this.repository.addNode({
                    groupId: newGroup.id,
                    type: "anonymous_fingerprint",
                    value: params.clientId,
                    merchantId: params.merchantId,
                });
            }

            log.debug(
                {
                    groupId: newGroup.id,
                    wallet: params.wallet,
                    clientId: params.clientId,
                },
                "Created new identity group for wallet"
            );
        }

        await this.resolveLockedRewards(groupsToResolve, params.wallet);

        return {
            identityGroupId: finalGroupId,
            merged: groupsToResolve.length > 0,
            mergedGroupIds: groupsToResolve,
        };
    }

    private async resolveLockedRewards(
        groupIds: string[],
        wallet: Address
    ): Promise<void> {
        if (groupIds.length === 0) return;

        const resolveOps: ResolveOp[] = groupIds.map((groupId) => ({
            userId: encodeUserId(groupId),
            wallet,
        }));

        try {
            const result = await this.rewardsHub.resolveUserIds(resolveOps);

            log.info(
                {
                    groupIds,
                    wallet,
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                },
                "Resolved userIds on RewardsHub"
            );
        } catch (error) {
            log.error(
                {
                    groupIds,
                    wallet,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to resolve userIds on RewardsHub"
            );
        }
    }

    async findByIdentifier(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<{
        id: string;
        walletAddress: Address | null;
    } | null> {
        const group = await this.repository.findGroupByIdentity(params);
        if (!group) return null;

        return {
            id: group.id,
            walletAddress: group.walletAddress as Address | null,
        };
    }

    private async mergeGroups(params: {
        anchorGroupId: string;
        mergingGroupId: string;
    }): Promise<void> {
        const movedCount = await this.repository.moveNodesToGroup(
            params.mergingGroupId,
            params.anchorGroupId
        );

        await this.repository.deleteGroup(params.mergingGroupId);

        log.debug(
            {
                anchorGroupId: params.anchorGroupId,
                mergingGroupId: params.mergingGroupId,
                movedNodes: movedCount,
            },
            "Merged identity groups"
        );
    }
}
