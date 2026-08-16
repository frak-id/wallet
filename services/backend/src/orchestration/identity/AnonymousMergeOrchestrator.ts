import {
    type IdentityCredentialClass,
    infraMetrics,
    log,
} from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";
import { enforceLatchedProof } from "./latchedProof";
import type { IdentityNode } from "./types";

export class AnonymousMergeOrchestrator {
    constructor(
        private readonly anonymousMergeService: AnonymousMergeService,
        private readonly identityRepository: IdentityRepository,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly identityProofService: IdentityProofService
    ) {}

    /**
     * Latch enforcement, shared by `initiateMerge`'s `sourceAnonymousId` arm
     * and `executeMerge`'s `targetAnonymousId` arm.
     *
     * Either side may be a legacy id (no key, can never produce a proof) and
     * must keep working: an unlatched id is allowed as an unproven source or
     * target so the pre-derivation population isn't cut off. The latch
     * closes the hole for every id that *does* have a key:
     *
     *   1. proof present → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒ allow.
     *   2. proof absent  → read the node's latch; latched ⇒ 403
     *      PROOF_REQUIRED, otherwise allow.
     *
     * The latch read happens only on the proof-absent path — the proven path
     * costs zero extra query.
     *
     * Returns whether a valid proof was presented, so the caller can decide
     * whether to (re-)write the latch.
     */
    private async enforceProof(params: {
        anonymousId: string;
        merchantId: string;
        proof?: string;
        binding: Uint8Array;
        context?: string;
        onClass: (credentialClass: IdentityCredentialClass) => void;
    }): Promise<boolean> {
        const { anonymousId, merchantId, proof, binding, context, onClass } =
            params;
        return enforceLatchedProof({
            op: "frak-merge-v1",
            anonymousId,
            merchantId,
            proof,
            binding,
            context: context ?? "merge execute (Phase 4a: enforced)",
            identityProofService: this.identityProofService,
            identityRepository: this.identityRepository,
            onClass,
        });
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
         * `frak-merge-v1` proof binding `sourceAnonymousId`. Latch-gated
         * whenever `sourceAnonymousId` is supplied: verified when present,
         * required only once this id has ever latched. A legacy id — or a
         * derived id that has simply never signed yet — keeps working
         * without one. The wallet arm (no `sourceAnonymousId`) is already
         * authenticated by session and never gated at all.
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

        // Runs BEFORE resolveAndAssociate below: that call can merge an
        // authenticated caller's wallet group into whatever group this
        // sourceAnonymousId resolves to, so an unverified id must never
        // reach it.
        //
        // Latch-gated, not unconditionally mandatory: a legacy id (no key,
        // can never sign) must still be usable as a merge source until it
        // has proven itself once. Same policy as `executeMerge`: proof
        // present → verify (invalid ⇒ 403 PROOF_INVALID); proof absent → 403
        // only if this id has ever latched, else allow. The wallet-session
        // arm (no `sourceAnonymousId`) is untouched — authenticated by
        // session, never by this check.
        //
        // ROLLOUT-STEP-3: revisit whether this arm should become
        // unconditionally mandatory once the wallet binary and legacy SDK
        // population have aged out.
        //
        // TODO(merge-initiate-proof): one production caller still sends no
        // proof here — the listener's modal / embedded-wallet path, via
        // `mergeTokenQueryOptions`. Those ids can therefore never latch. That
        // caller must send a proof before this arm is made mandatory, or the
        // in-app-browser escape 403s outright. The SDK's RPC path
        // (`useOnGetMergeToken`) already sends one.
        const sourceProofPresented = sourceAnonymousId
            ? await this.enforceProof({
                  anonymousId: sourceAnonymousId,
                  merchantId,
                  proof,
                  binding: new Uint8Array(0),
                  context: "merge initiate (latch-gated)",
                  onClass: (credentialClass) => {
                      infraMetrics.identityMergeInitiateCredential(
                          credentialClass
                      );
                      if (credentialClass === "absent_unlatched") {
                          log.info(
                              {
                                  merchantId,
                                  sourceAnonymousId,
                                  route: "merge/initiate",
                              },
                              "Merge admission would be refused once proof is mandatory"
                          );
                      }
                  },
              })
            : false;

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

        if (sourceAnonymousId && sourceProofPresented) {
            // Written only now: the node isn't guaranteed to exist before
            // `resolveAndAssociate` above creates it. Gated on
            // `sourceProofPresented`, not unconditional — latching an id
            // that never proved possession would permanently lock it out
            // of ever being a merge source again.
            await this.identityRepository.markProofSeen({
                type: "anonymous_fingerprint",
                value: sourceAnonymousId,
                merchantId,
            });
        }

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
         * `SHA-256(mergeToken)`. The token binding removes the need for a
         * replay cache — a stolen proof is useless without the exact,
         * 60-min-lived token it was signed alongside. Required only once
         * this id has ever latched — unlatched ids, including legacy ones,
         * keep working as merge targets, but only ones that already exist:
         * creating the target is what a proof buys.
         */
        proof?: string;
    }): Promise<{ finalGroupId: string; merged: boolean }> {
        const { mergeToken, targetAnonymousId, merchantId, proof } = params;

        // Verified before anything is created or merged. The latch write it
        // authorises is deferred until the target node exists — see below.
        const proofPresented = await this.enforceProof({
            anonymousId: targetAnonymousId,
            merchantId,
            proof,
            binding: this.identityProofService.hashMergeToken(mergeToken),
            onClass: (credentialClass) => {
                infraMetrics.identityMergeExecuteCredential(credentialClass);
                if (credentialClass === "absent_unlatched") {
                    log.info(
                        {
                            merchantId,
                            targetAnonymousId,
                            route: "merge/execute",
                        },
                        "Merge admission would be refused once proof is mandatory"
                    );
                }
            },
        });

        const { sourceGroupId, sourceWalletAddress } =
            await this.anonymousMergeService.validateToken({
                mergeToken,
                merchantId,
            });

        // Alarm only, never a gate: `/merge/initiate` accepts a
        // `sourceAnonymousId` alongside a wallet session, so an attacker
        // presenting their own proven id never trips this.
        if (sourceWalletAddress && !proofPresented) {
            infraMetrics.identityMergeExecuteWalletSourceUnproven(merchantId);
            log.warn(
                { merchantId, targetAnonymousId, sourceWalletAddress },
                "Merge execute redeemed a wallet-session token with no target proof"
            );
        }

        // Get-or-create, but only for a caller that proved possession of the
        // target's key. A native SDK signs its merge proof from a device that
        // has never sent an interaction, so the target legitimately does not
        // exist yet and the flow's first act is to make it. Without a proof,
        // creating one would let any caller name an arbitrary id and have it
        // conjured into their group — both routes here are unauthenticated.
        // `resolve` is race-safe: two concurrent redemptions contend on the
        // node's unique constraint and the loser rolls its empty group back.
        const targetGroupId = proofPresented
            ? (
                  await this.identityOrchestrator.resolve({
                      type: "anonymous_fingerprint",
                      value: targetAnonymousId,
                      merchantId,
                  })
              ).groupId
            : (
                  await this.identityRepository.findGroupByIdentity({
                      type: "anonymous_fingerprint",
                      value: targetAnonymousId,
                      merchantId,
                  })
              )?.id;
        if (!targetGroupId) {
            // Proofless and absent. Legacy migration lands here only if its
            // legacy id never existed, which is not a case it can produce.
            throw HttpError.notFound(
                "TARGET_NOT_FOUND",
                "targetAnonymousId does not exist; a proof is required to create it"
            );
        }

        // After `resolve`, never before: `markProofSeen` is a no-op when the
        // node is absent, so latching a brand-new id here silently did nothing.
        if (proofPresented) {
            await this.identityRepository.markProofSeen({
                type: "anonymous_fingerprint",
                value: targetAnonymousId,
                merchantId,
            });
        }

        // Delegate to IdentityOrchestrator.associate() which handles
        // idempotency, wallet conflict detection (throws HttpError), weight-
        // based anchor determination, merge execution, and cache invalidation.
        const { finalGroupId, merged } =
            await this.identityOrchestrator.associate(
                sourceGroupId,
                targetGroupId
            );

        if (merged) {
            log.info(
                {
                    sourceGroupId,
                    targetGroupId,
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
