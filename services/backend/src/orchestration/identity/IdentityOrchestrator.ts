import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityWeightService } from "./IdentityWeightService";
import type { AssociateResult, IdentityNode, ResolveResult } from "./types";

export class IdentityOrchestrator {
    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly weightService: IdentityWeightService,
        private readonly mergeService: IdentityMergeService
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

        // Prevent merging groups linked to different wallets
        if (
            weight1.wallet &&
            weight2.wallet &&
            weight1.wallet !== weight2.wallet
        ) {
            throw HttpError.conflict(
                "WALLET_CONFLICT",
                `Cannot merge identities linked to different wallets: ${weight1.wallet} ↔ ${weight2.wallet}`
            );
        }

        const { anchorGroupId, mergingGroupId } =
            this.weightService.determineAnchor(weight1, weight2);

        await this.mergeService.mergeGroups({
            anchorGroupId,
            mergingGroupIds: [mergingGroupId],
        });

        this.weightService.invalidateWeight(mergingGroupId);
        this.identityRepository.invalidateCachesForGroup(mergingGroupId);

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

        const weights = await Promise.all(
            uniqueGroupIds.map((id) => this.weightService.getGroupWeight(id))
        );

        const { anchorGroupId, mergingGroupIds } =
            this.weightService.determineAnchorFromMultiple(weights);

        if (mergingGroupIds.length === 0) {
            return { finalGroupId: anchorGroupId, merged: false };
        }

        await this.mergeService.mergeGroups({
            anchorGroupId,
            mergingGroupIds,
        });

        for (const groupId of mergingGroupIds) {
            this.weightService.invalidateWeight(groupId);
            this.identityRepository.invalidateCachesForGroup(groupId);
        }

        return { finalGroupId: anchorGroupId, merged: true };
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        return this.identityRepository.getWalletForGroup(groupId);
    }

    /**
     * Anchor a wallet to its anonymous fingerprint (when both are known) and
     * swallow any failure. Used by the auth routes after a successful login or
     * registration so an identity-graph hiccup never blocks the auth response.
     *
     * When `email` is provided, attach it to the resolved wallet group as a
     * dedicated email identity node — unless that email already belongs to a
     * different group, in which case we log + skip (collisions are owned by
     * the explicit wallet-merge flow, not by silent registration writes).
     */
    async linkWalletToFingerprint(params: {
        walletAddress: Address;
        clientId?: string;
        merchantId?: string;
        email?: string;
    }): Promise<void> {
        const { walletAddress, clientId, merchantId, email } = params;
        try {
            const nodes: IdentityNode[] = [
                { type: "wallet", value: walletAddress },
            ];
            if (clientId && merchantId) {
                nodes.push({
                    type: "anonymous_fingerprint",
                    value: clientId,
                    merchantId,
                });
            }
            const result = await this.resolveAndAssociate(nodes);

            if (email) {
                const existing =
                    await this.identityRepository.findGroupByIdentity({
                        type: "email",
                        value: email,
                    });
                if (existing && existing.id !== result.finalGroupId) {
                    log.warn(
                        { walletAddress, email, existingGroupId: existing.id },
                        "Email already belongs to a different identity group; skipping attach at register"
                    );
                } else if (!existing) {
                    await this.identityRepository.addNode({
                        groupId: result.finalGroupId,
                        type: "email",
                        value: email,
                    });
                }
            }
        } catch (err: unknown) {
            log.error(
                { err, walletAddress, merchantId },
                "Failed to connect wallet to identity"
            );
        }
    }
}
