import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ProofOp } from "@frak-labs/core-sdk/identity";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";

/**
 * Shared latch-gated proof policy: keeps legacy ids (no key, can never
 * produce a proof) working while closing the hole for any id that HAS
 * proven itself once.
 *
 *   1. proof present → verify; invalid ⇒ 403 PROOF_INVALID, valid ⇒ allow.
 *   2. proof absent  → read the node's latch; latched ⇒ 403 PROOF_REQUIRED,
 *      otherwise allow (fail-open, matching pre-proof behaviour).
 *
 * The latch read happens only on the proof-absent path — the proven path
 * costs zero extra query.
 *
 * Returns whether a valid proof was presented. Callers MUST NOT latch an id
 * when this returns `false` — `markProofSeen` never clears, so that would
 * permanently lock out an id that never proved possession.
 *
 * Standalone rather than a method on `IdentityProofService`, which stays
 * pure and repository-free for unit-testability; this is the one place
 * that composes proof verification with the latch read.
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

/**
 * Verify a proof for evidence only: log when it is invalid, never reject, and
 * never require one in the first place.
 *
 * The permissive arms that stay open until ROLLOUT-STEP-3 (`/identity/ensure`'s
 * wallet arm, `install-code/generate`) all need exactly this shape, and a proof
 * can only add evidence there — it can never remove any, since the same arms
 * accept a bare `anonymousId`.
 *
 * Returns whether a valid proof was presented. As with `enforceLatchedProof`,
 * callers MUST NOT latch an id on a `false` return.
 */
export async function verifyProofUnenforced(params: {
    op: ProofOp;
    anonymousId: string;
    merchantId: string;
    proof: string;
    binding?: Uint8Array;
    identityProofService: IdentityProofService;
}): Promise<boolean> {
    const {
        op,
        anonymousId,
        merchantId,
        proof,
        binding,
        identityProofService,
    } = params;

    const result = await identityProofService.verify({
        op,
        proof,
        merchantId,
        anonymousId,
        binding: binding ?? new Uint8Array(0),
    });

    if (!result.valid) {
        log.info(
            { op, merchantId, anonymousId, reason: result.reason },
            "Identity proof present but invalid (verified, not enforced — ROLLOUT-STEP-3)"
        );
    }

    return result.valid;
}
