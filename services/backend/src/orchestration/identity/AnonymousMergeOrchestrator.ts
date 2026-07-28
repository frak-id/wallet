import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityNode } from "./types";

export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly identityProofService: IdentityProofService
    ) {}

    /**
     * Verify an optional proof and log the outcome (README §7 Phase 2
     * acceptance: the valid/invalid/absent split must be observable).
     *
     * Phase 2 is accept-but-don't-enforce (README §7): an absent proof is
     * not a failure and behaves exactly as today. An INVALID proof is
     * logged and telemetered but does NOT reject the call — enforcement is
     * Phase 4a (C13), gated on the §4.6 `proofSeen` latch so only ids that
     * have ever proven themselves become strict. Verifying-but-not-blocking
     * here would otherwise silently break any in-flight legitimate caller
     * whose proof is malformed for a reason Phase 2 hasn't anticipated
     * (clock skew beyond the allowance, a not-yet-migrated proof format,
     * etc.) — exactly the kind of flag-day risk §4.6 exists to avoid.
     */
    private async checkProof(params: {
        op: "frak-merge-v1";
        proof: string;
        merchantId: string;
        anonymousId: string;
        binding: Uint8Array;
    }): Promise<void> {
        const result = await this.identityProofService.verify(params);
        if (!result.valid) {
            log.info(
                {
                    op: params.op,
                    merchantId: params.merchantId,
                    reason: result.reason,
                },
                "Identity proof present but invalid (Phase 2: logged, not enforced)"
            );
        }
    }

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
        /**
         * `frak-merge-v1` proof binding `sourceAnonymousId` (README §4.2).
         * Only meaningful when `sourceAnonymousId` is supplied — the wallet
         * arm is already authenticated by session and needs no proof.
         * Phase 2: verified and logged when present, never required.
         */
        proof?: string;
    }): Promise<{ mergeToken: string; expiresAt: Date }> {
        const { sourceAnonymousId, sourceWalletAddress, merchantId, proof } =
            params;

        if (!sourceAnonymousId && !sourceWalletAddress) {
            throw HttpError.badRequest(
                "MISSING_SOURCE_IDENTITY",
                "sourceAnonymousId or sourceWalletAddress is required"
            );
        }

        if (proof && sourceAnonymousId) {
            // No mergeToken exists yet at initiate time, so the binding is
            // empty — mirrors frak-ensure-v1/frak-install-v1 (README §2.3).
            await this.checkProof({
                op: "frak-merge-v1",
                proof,
                merchantId,
                anonymousId: sourceAnonymousId,
                binding: new Uint8Array(0),
            });
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
        /**
         * `frak-merge-v1` proof binding `targetAnonymousId` AND
         * `SHA-256(mergeToken)` (README §2.2, §4.3). The token binding is
         * what removes the need for a replay cache on this path — a stolen
         * proof is useless without the exact, 60-min-lived token it was
         * signed alongside. Phase 2: verified and logged when present,
         * never required.
         */
        proof?: string;
    }): Promise<{ finalGroupId: string; merged: boolean }> {
        const { mergeToken, targetAnonymousId, merchantId, proof } = params;

        if (proof) {
            await this.checkProof({
                op: "frak-merge-v1",
                proof,
                merchantId,
                anonymousId: targetAnonymousId,
                binding: this.identityProofService.hashMergeToken(mergeToken),
            });
        }

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
        // Delegate to IdentityOrchestrator.associate() which handles
        // idempotency, wallet conflict detection (throws HttpError), weight-
        // based anchor determination, merge execution, and cache invalidation.
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
    }
}
