import { HttpError } from "@backend-utils";
import type { ProofOp } from "@frak-labs/core-sdk/identity";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";

/**
 * Shared latch-gated proof policy (README §4.6, §7 Phase 4a; DECISIONS
 * §2.3; DUAL-ARM-PLAN.md WS-BE-1).
 *
 * Used by every arm that must keep working for legacy ids — which have no
 * key and can never produce a proof — while still closing the hole for any
 * id that HAS proven itself once:
 *
 *   1. proof present  → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒ allow.
 *   2. proof absent   → read the node's latch; latched ⇒ 403 PROOF_REQUIRED,
 *      otherwise allow (legacy id, or a derived id that has simply never
 *      proven itself yet — fail-open, matching pre-proof behaviour).
 *
 * The latch read happens ONLY on the proof-absent path — the proven path
 * (the future steady state) costs zero extra query, verification being pure
 * CPU.
 *
 * Returns whether a valid proof was presented, so the caller can decide
 * whether to (re-)write the latch. Callers MUST NOT latch an id when this
 * returns `false` — that would permanently lock out an id that never proved
 * possession (a one-way corruption, since `markProofSeen` never clears).
 *
 * Deliberately a standalone function, not a method on `IdentityProofService`:
 * DECISIONS §2.3 requires that service to stay pure and repository-free so
 * it remains trivially unit-testable with no DB mock. This function is the
 * one place that composes proof verification with the latch read.
 */
export async function enforceLatchedProof(params: {
    op: ProofOp;
    anonymousId: string;
    merchantId: string;
    proof?: string;
    binding: Uint8Array;
    context: string;
    identityProofService: IdentityProofService;
    identityRepository: IdentityRepository;
}): Promise<boolean> {
    const {
        op,
        anonymousId,
        merchantId,
        proof,
        binding,
        context,
        identityProofService,
        identityRepository,
    } = params;

    if (proof) {
        await identityProofService.verifyOrThrow({
            op,
            context,
            proof,
            merchantId,
            anonymousId,
            binding,
        });
        return true;
    }

    const node = await identityRepository.findNodeByIdentity({
        type: "anonymous_fingerprint",
        value: anonymousId,
        merchantId,
    });
    if (node?.proofSeenAt) {
        throw HttpError.forbidden(
            "PROOF_REQUIRED",
            "This identity has previously proven possession of its key and now requires a proof on every merge"
        );
    }
    // Unlatched — legacy id, or a derived id that has never proven itself
    // yet. Fail-open, matching today's pre-proof behaviour.
    return false;
}
