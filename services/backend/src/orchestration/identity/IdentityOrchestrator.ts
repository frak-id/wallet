import { eventEmitter, log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { PendingIdentityResolutionRepository } from "../../domain/identity/repositories/PendingIdentityResolutionRepository";
import { IdentityMergeService } from "./IdentityMergeService";
import { IdentityWeightService } from "./IdentityWeightService";
import type { AssociateResult, IdentityNode, ResolveResult } from "./types";

export class IdentityOrchestrator {
    private readonly weightService = new IdentityWeightService();
    private readonly mergeService = new IdentityMergeService();

    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly pendingResolutionRepository: PendingIdentityResolutionRepository
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
            return {
                finalGroupId: groupId1,
                merged: false,
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

        if (anchorWallet) {
            const groupIdsToResolve = [mergingGroupId, ...previousMergedGroups];
            await this.queueIdentityResolutions(
                groupIdsToResolve,
                anchorWallet
            );
        }

        return {
            finalGroupId: anchorGroupId,
            merged: true,
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
            return {
                finalGroupId: uniqueGroupIds[0],
                merged: false,
            };
        }

        let currentGroupId = uniqueGroupIds[0];
        let anyMerged = false;

        for (let i = 1; i < uniqueGroupIds.length; i++) {
            const result = await this.associate(
                currentGroupId,
                uniqueGroupIds[i]
            );
            currentGroupId = result.finalGroupId;
            anyMerged = anyMerged || result.merged;
        }

        return {
            finalGroupId: currentGroupId,
            merged: anyMerged,
        };
    }

    private async queueIdentityResolutions(
        groupIds: string[],
        wallet: Address
    ): Promise<void> {
        if (groupIds.length === 0) return;

        const queueParams = groupIds.map((groupId) => ({
            groupId,
            walletAddress: wallet,
        }));

        try {
            await this.pendingResolutionRepository.queueBatch(queueParams);

            log.debug(
                { groupIds, wallet, count: groupIds.length },
                "Queued identity resolutions for async processing"
            );

            eventEmitter.emit("newPendingIdentityResolution", {
                count: groupIds.length,
            });
        } catch (error) {
            log.error(
                {
                    groupIds,
                    wallet,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to queue identity resolutions"
            );
        }
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        return this.weightService.getWalletForGroup(groupId);
    }
}
