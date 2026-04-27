import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityNode } from "./types";
import { WalletConflictError } from "./types";
export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    /**
     * Initiate an identity merge by generating a JWT token bound to a source
     * identity group and merchant.
     *
     * Supports two source shapes:
     *  1. Anonymous fingerprint (existing flow) — partner site SDK hands off
     *     its `clientId` across browser contexts (e.g. in-app → external).
     *  2. Authenticated wallet (explorer flow) — wallet app mints a token
     *     representing the wallet identity so the merchant SDK can link the
     *     wallet into its per-merchant anonymous group on arrival.
     *
     * IMPORTANT: Auto-creates the source identity group when only an
     * anonymous fingerprint is provided. This is necessary because the SDK
     * generates `clientId` on first page load, but the identity group is
     * only created when the user performs an action (tracking, auth, etc.).
     * Pattern matches: /track/arrival, /wallet/auth/register, /wallet/auth/login.
     */
    async initiateMerge(params: {
        merchantId: string;
        sourceAnonymousId?: string;
        sourceWalletAddress?: Address;
    }): Promise<{ mergeToken: string; expiresAt: Date }> {
        const { sourceAnonymousId, sourceWalletAddress, merchantId } = params;

        if (!sourceAnonymousId && !sourceWalletAddress) {
            throw HttpError.badRequest(
                "MISSING_SOURCE_IDENTITY",
                "sourceAnonymousId or sourceWalletAddress is required"
            );
        }

        // Build source identity nodes. Wallet nodes are merchant-agnostic;
        // anonymous fingerprints are scoped to the merchant.
        const identityNodes: IdentityNode[] = [];
        if (sourceWalletAddress) {
            identityNodes.push({ type: "wallet", value: sourceWalletAddress });
        }
        if (sourceAnonymousId) {
            identityNodes.push({
                type: "anonymous_fingerprint",
                value: sourceAnonymousId,
                merchantId,
            });
        }

        // resolveAndAssociate is idempotent and also merges the wallet ↔
        // anon-fingerprint groups when both are provided (e.g. wallet app
        // has both values in its context).
        const { finalGroupId: sourceGroupId } =
            await this.identityOrchestrator.resolveAndAssociate(identityNodes);

        return this.anonymousMergeService.generateToken({
            sourceAnonymousId,
            sourceWalletAddress,
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
    }): Promise<{ finalGroupId: string; merged: boolean }> {
        const { mergeToken, targetAnonymousId, merchantId } = params;

        // 1. Validate the token
        const { sourceGroupId } =
            await this.anonymousMergeService.validateToken({
                mergeToken,
                merchantId,
            });
        // 2. Resolve target group
        const targetGroup = await this.identityRepository.findGroupByIdentity({
            type: "anonymous_fingerprint",
            value: targetAnonymousId,
            merchantId,
        });

        if (!targetGroup) {
            throw HttpError.notFound(
                "TARGET_NOT_FOUND",
                "Target anonymous identity not found"
            );
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
                throw HttpError.conflict(error.code, error.message);
            }
            throw error;
        }
    }
}
