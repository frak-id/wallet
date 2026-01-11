import { log } from "@backend-infrastructure";
import { encodeUserId } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type {
    ResolveOp,
    RewardsHubRepository,
} from "../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { IdentityMergeService } from "./IdentityMergeService";
import { IdentityWeightService } from "./IdentityWeightService";
import type { AssociateResult, IdentityNode, ResolveResult } from "./types";

export class IdentityOrchestrator {
    private readonly weightService = new IdentityWeightService();
    private readonly mergeService = new IdentityMergeService();

    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly rewardsHub: RewardsHubRepository
    ) {}

    async resolve(node: IdentityNode): Promise<ResolveResult> {
        const existingGroup = await this.identityRepository.findGroupByIdentity(
            {
                type: node.type,
                value: node.value,
                merchantId: "merchantId" in node ? node.merchantId : undefined,
            }
        );

        if (existingGroup) {
            return { groupId: existingGroup.id, isNew: false };
        }

        const newGroup = await this.identityRepository.createGroup();
        await this.identityRepository.addNode({
            groupId: newGroup.id,
            type: node.type,
            value: node.value,
            merchantId: "merchantId" in node ? node.merchantId : undefined,
        });

        log.debug(
            { groupId: newGroup.id, nodeType: node.type },
            "Created new identity group"
        );

        return { groupId: newGroup.id, isNew: true };
    }

    async associate(
        groupId1: string,
        groupId2: string
    ): Promise<AssociateResult> {
        if (groupId1 === groupId2) {
            const wallet = await this.weightService.getWalletForGroup(groupId1);
            return {
                finalGroupId: groupId1,
                merged: false,
                groupIdsToResolveOnchain: wallet ? [] : [groupId1],
            };
        }

        const [weight1, weight2] = await Promise.all([
            this.weightService.getGroupWeight(groupId1),
            this.weightService.getGroupWeight(groupId2),
        ]);

        const { anchorGroupId, mergingGroupId, anchorWallet } =
            this.weightService.determineAnchor(weight1, weight2);

        const previousMergedGroups =
            await this.mergeService.getMergedGroupIds(mergingGroupId);

        await this.mergeService.mergeGroups({ anchorGroupId, mergingGroupId });

        const groupIdsToResolveOnchain = anchorWallet
            ? [mergingGroupId, ...previousMergedGroups]
            : [];

        return {
            finalGroupId: anchorGroupId,
            merged: true,
            groupIdsToResolveOnchain,
        };
    }

    async resolveAndAssociate(nodes: IdentityNode[]): Promise<AssociateResult> {
        if (nodes.length === 0) {
            throw new Error("At least one identity node is required");
        }

        const resolveResults = await Promise.all(
            nodes.map((node) => this.resolve(node))
        );

        const uniqueGroupIds = [
            ...new Set(resolveResults.map((r) => r.groupId)),
        ];

        if (uniqueGroupIds.length === 1) {
            const wallet = await this.weightService.getWalletForGroup(
                uniqueGroupIds[0]
            );
            return {
                finalGroupId: uniqueGroupIds[0],
                merged: false,
                groupIdsToResolveOnchain: wallet ? [] : [],
            };
        }

        let currentGroupId = uniqueGroupIds[0];
        let allGroupIdsToResolve: string[] = [];
        let anyMerged = false;

        for (let i = 1; i < uniqueGroupIds.length; i++) {
            const result = await this.associate(
                currentGroupId,
                uniqueGroupIds[i]
            );
            currentGroupId = result.finalGroupId;
            allGroupIdsToResolve = [
                ...allGroupIdsToResolve,
                ...result.groupIdsToResolveOnchain,
            ];
            anyMerged = anyMerged || result.merged;
        }

        const finalWallet =
            await this.weightService.getWalletForGroup(currentGroupId);
        if (finalWallet && allGroupIdsToResolve.length > 0) {
            await this.resolveLockedRewards(allGroupIdsToResolve, finalWallet);
        }

        return {
            finalGroupId: currentGroupId,
            merged: anyMerged,
            groupIdsToResolveOnchain: allGroupIdsToResolve,
        };
    }

    async resolveLockedRewards(
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

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        return this.weightService.getWalletForGroup(groupId);
    }
}
