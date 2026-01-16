import { log } from "@backend-infrastructure";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityWeightService } from "./IdentityWeightService";

type InitiateMergeResult =
    | { success: true; mergeToken: string; expiresAt: Date }
    | { success: false; error: string; code: string };

type ExecuteMergeResult =
    | { success: true; finalGroupId: string; merged: boolean }
    | { success: false; error: string; code: string };

export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly weightService: IdentityWeightService,
        private readonly mergeService: IdentityMergeService,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    /**
     * Initiate anonymous identity merge by generating a JWT token
     *
     * IMPORTANT: This auto-creates the source identity if it doesn't exist yet.
     * This is necessary because the SDK generates clientId on first page load,
     * but the identity group is only created when user performs an action
     * (tracking, auth, etc.). Without this, merge token generation would fail
     * with "Source not found" error.
     *
     * Pattern matches: /track/arrival, /wallet/auth/register, /wallet/auth/login
     * All use identityOrchestrator.resolveAndAssociate() to create-or-get identity.
     */
    async initiateMerge(params: {
        sourceAnonymousId: string;
        merchantId: string;
    }): Promise<InitiateMergeResult> {
        const { sourceAnonymousId, merchantId } = params;

        // Create source identity if it doesn't exist (idempotent)
        // Same pattern as /track/arrival and auth endpoints
        const { finalGroupId: sourceGroupId } =
            await this.identityOrchestrator.resolveAndAssociate([
                {
                    type: "anonymous_fingerprint",
                    value: sourceAnonymousId,
                    merchantId,
                },
            ]);

        return this.anonymousMergeService.generateToken({
            sourceAnonymousId,
            merchantId,
            sourceGroupId,
        });
    }

    /**
     * Execute the merge using a valid token
     */
    async executeMerge(params: {
        mergeToken: string;
        targetAnonymousId: string;
        merchantId: string;
    }): Promise<ExecuteMergeResult> {
        const { mergeToken, targetAnonymousId, merchantId } = params;

        // 1. Validate the token
        const validation = await this.anonymousMergeService.validateToken({
            mergeToken,
            merchantId,
        });

        if (!validation.success) {
            return validation;
        }

        const { sourceGroupId } = validation;

        // 2. Resolve target group
        const targetGroup = await this.identityRepository.findGroupByIdentity({
            type: "anonymous_fingerprint",
            value: targetAnonymousId,
            merchantId,
        });

        if (!targetGroup) {
            return {
                success: false,
                error: "Target anonymous identity not found",
                code: "TARGET_NOT_FOUND",
            };
        }

        // 3. Check if they're already the same group (idempotent)
        if (sourceGroupId === targetGroup.id) {
            log.debug(
                { sourceGroupId, targetGroupId: targetGroup.id },
                "Anonymous merge: groups already identical"
            );
            return {
                success: true,
                finalGroupId: sourceGroupId,
                merged: false,
            };
        }

        // 4. Check for wallet conflicts
        const [sourceWeight, targetWeight] = await Promise.all([
            this.weightService.getGroupWeight(sourceGroupId),
            this.weightService.getGroupWeight(targetGroup.id),
        ]);

        if (sourceWeight.hasWallet && targetWeight.hasWallet) {
            if (sourceWeight.wallet !== targetWeight.wallet) {
                log.warn(
                    {
                        sourceGroupId,
                        targetGroupId: targetGroup.id,
                        sourceWallet: sourceWeight.wallet,
                        targetWallet: targetWeight.wallet,
                    },
                    "Attempted to merge groups with different wallets"
                );
                return {
                    success: false,
                    error: "Cannot merge identities linked to different wallets",
                    code: "WALLET_CONFLICT",
                };
            }
        }

        // 5. Determine anchor and perform merge
        const { anchorGroupId, mergingGroupId } =
            this.weightService.determineAnchor(sourceWeight, targetWeight);

        await this.mergeService.mergeGroups({ anchorGroupId, mergingGroupId });

        // 6. Invalidate caches
        this.weightService.invalidateWeight(mergingGroupId);
        this.identityRepository.invalidateCachesForGroup(mergingGroupId);

        log.info(
            {
                sourceGroupId,
                targetGroupId: targetGroup.id,
                anchorGroupId,
                mergingGroupId,
            },
            "Anonymous identity groups merged successfully"
        );

        return {
            success: true,
            finalGroupId: anchorGroupId,
            merged: true,
        };
    }
}
