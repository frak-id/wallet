import { log } from "@backend-infrastructure";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import { WalletConflictError } from "./types";

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
     * Execute the merge using a valid token.
     *
     * Delegates the actual merge to IdentityOrchestrator.associate() which
     * handles idempotency, wallet conflict detection, weight-based anchor
     * determination, merge execution, and cache invalidation.
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

        // 3. Delegate to IdentityOrchestrator.associate() which handles:
        //    - Idempotency (same group → no-op)
        //    - Wallet conflict detection (throws WalletConflictError)
        //    - Weight-based anchor determination
        //    - Merge execution and cache invalidation
        try {
            const { finalGroupId, merged } =
                await this.identityOrchestrator.associate(
                    sourceGroupId,
                    targetGroup.id
                );

            if (merged) {
                log.info(
                    {
                        sourceGroupId,
                        targetGroupId: targetGroup.id,
                        finalGroupId,
                    },
                    "Anonymous identity groups merged successfully"
                );
            }

            return {
                success: true,
                finalGroupId,
                merged,
            };
        } catch (error) {
            if (error instanceof WalletConflictError) {
                log.warn(
                    {
                        sourceGroupId,
                        targetGroupId: targetGroup.id,
                        sourceWallet: error.sourceWallet,
                        targetWallet: error.targetWallet,
                    },
                    "Attempted to merge groups with different wallets"
                );
                return {
                    success: false,
                    error: error.message,
                    code: error.code,
                };
            }
            throw error;
        }
    }
}
