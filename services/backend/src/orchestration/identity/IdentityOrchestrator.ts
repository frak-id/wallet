import { db, infraMetrics, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { type Address, isAddressEqual } from "viem";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityWeightService } from "./IdentityWeightService";
import type { AssociateResult, IdentityNode, ResolveResult } from "./types";

/**
 * A `WALLET_CONFLICT` here is a refused merge between two wallet-bearing
 * groups, not a transient fault — it needs its own signal. Everything stays
 * swallowed either way: an identity link failure must never block login.
 */
function reportLinkFailure(
    err: unknown,
    context: { walletAddress: Address; merchantId?: string }
): void {
    if (err instanceof HttpError && err.code === "WALLET_CONFLICT") {
        infraMetrics.identityWalletConflict("link_wallet_to_fingerprint");
        log.warn(
            context,
            "Refused to merge groups linked to different wallets while connecting wallet to identity"
        );
        return;
    }
    log.error({ err, ...context }, "Failed to connect wallet to identity");
}

export class IdentityOrchestrator {
    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly weightService: IdentityWeightService,
        private readonly mergeService: IdentityMergeService,
        private readonly identityProofService: IdentityProofService
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

        // Two concurrent resolves for a new identity can both see no existing
        // group; only one wins the unique constraint on the node insert. Run in
        // a transaction so the loser can roll back its orphaned empty group.
        return db.transaction(async (tx) => {
            const newGroup = await this.identityRepository.createGroup(tx);
            const attachedNode = await this.identityRepository.addNode(
                {
                    groupId: newGroup.id,
                    type: node.type,
                    value: node.value,
                    merchantId:
                        "merchantId" in node ? node.merchantId : undefined,
                },
                tx
            );

            if (attachedNode.groupId !== newGroup.id) {
                // Lost the race: delete our now-orphaned empty group.
                await this.identityRepository.deleteGroup(newGroup.id, tx);

                log.debug(
                    { groupId: attachedNode.groupId, nodeType: node.type },
                    "Lost identity group creation race; reusing existing group"
                );

                return { groupId: attachedNode.groupId, isNew: false };
            }

            log.debug(
                { groupId: newGroup.id, nodeType: node.type },
                "Created new identity group"
            );

            return { groupId: newGroup.id, isNew: true };
        });
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
            !isAddressEqual(weight1.wallet, weight2.wallet)
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

        // The anchor is invalidated too: it just absorbed the loser's assets,
        // referrals and interactions, so its cached weight is now understated
        // for the rest of the 30s TTL — long enough to skew a follow-up merge's
        // tie-break.
        this.weightService.invalidateWeight(anchorGroupId);
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

        // See `associate` — the anchor's own weight changed as well.
        this.weightService.invalidateWeight(anchorGroupId);
        for (const groupId of mergingGroupIds) {
            this.weightService.invalidateWeight(groupId);
            this.identityRepository.invalidateCachesForGroup(groupId);
        }

        return { finalGroupId: anchorGroupId, merged: true };
    }

    /**
     * Resolve nodes to a single attribution group WITHOUT merging.
     *
     * Precedence: the authenticated wallet's group when a wallet node is
     * present, else the anonymous fingerprint's. A forged `x-frak-client-id`
     * can then only mis-attribute into the forger's own group, never move
     * anyone else's group — `mergeGroups` is never called from this path.
     *
     * Only the anchor node is resolved. Resolving the others would create
     * identity groups for identities we are not attributing to — pure write
     * amplification on every `track/*` request for no benefit.
     */
    async resolveForAttribution(
        nodes: IdentityNode[]
    ): Promise<{ groupId: string }> {
        if (nodes.length === 0) {
            throw new Error("At least one identity node is required");
        }

        const anchor = nodes.find((node) => node.type === "wallet") ?? nodes[0];
        const { groupId } = await this.resolve(anchor);
        return { groupId };
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        return this.identityRepository.getWalletForGroup(groupId);
    }

    /**
     * Anchor a wallet to its anonymous fingerprint (when both are known) and
     * swallow any failure — an identity-graph hiccup must never block login
     * or register.
     *
     * `clientId` arrives via the UNVERIFIED `x-frak-client-id` header, so the
     * merge is gated on a `frak-sso-v1` proof: a valid proof merges as
     * before, an absent/invalid one just skips it (login/register still
     * succeed — `/identity/ensure` covers the proof-gated link later for
     * legacy callers).
     *
     * When `email` is provided, attach it to the resolved wallet group
     * unless it already belongs to a different group, in which case log +
     * skip (collisions belong to the explicit wallet-merge flow).
     */
    async linkWalletToFingerprint(params: {
        walletAddress: Address;
        clientId?: string;
        merchantId?: string;
        email?: string;
        proof?: string;
    }): Promise<void> {
        const { walletAddress, clientId, merchantId, email, proof } = params;
        try {
            const nodes: IdentityNode[] = [
                { type: "wallet", value: walletAddress },
            ];

            let proofVerified = false;
            if (clientId && merchantId && proof) {
                const verification = await this.identityProofService.verify({
                    op: "frak-sso-v1",
                    proof,
                    merchantId,
                    anonymousId: clientId,
                    binding: new Uint8Array(0),
                });
                proofVerified = verification.valid;
                if (verification.valid) {
                    nodes.push({
                        type: "anonymous_fingerprint",
                        value: clientId,
                        merchantId,
                    });
                } else {
                    log.warn(
                        {
                            merchantId,
                            clientId,
                            reason: verification.reason,
                        },
                        "Rejected SSO identity proof; skipping anonymous fingerprint merge at login"
                    );
                }
            }

            const result = await this.resolveAndAssociate(nodes);

            if (proofVerified && clientId && merchantId) {
                // Gated on `proofVerified`, not unconditional: `markProofSeen`
                // never clears, so latching an unverified id would lock it
                // out of ever proving itself (see latchedProof.ts).
                await this.identityRepository.markProofSeen({
                    type: "anonymous_fingerprint",
                    value: clientId,
                    merchantId,
                });
            }

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
            reportLinkFailure(err, { walletAddress, merchantId });
        }
    }
}
