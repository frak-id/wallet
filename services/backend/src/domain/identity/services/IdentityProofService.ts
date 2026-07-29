import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import {
    buildProofMessage,
    decodeProof,
    deriveClientIdFromHash,
    type ProofOp,
    type ProofVerification,
} from "@frak-labs/core-sdk/identity";
import { sha256 } from "@oslojs/crypto/sha2";
import { infraMetrics } from "../../../infrastructure/telemetry";

/**
 * Per-op validity windows (README §2.2), seconds.
 *
 * `frak-ensure-v1` is 30 days here, NOT the 90 days the README table lists —
 * see `docs/plans/identity-proof-of-possession/DECISIONS.md` §3 divergence
 * D5. The 90-day justification is the install→forget→reopen funnel, which
 * runs on the wallet's ensure arm — and that arm carries a *ticket* (§5),
 * capped at the 7-day `DEFAULT_ENSURE_TTL_MS` pending-action TTL, not this
 * proof. The SDK arm signs in place at call time, so a long window here
 * buys nothing and only extends bearer exposure. This is backend policy,
 * not the frozen wire format, so it stays revisable independently of the
 * byte layout in `canonical.ts`.
 */
const PROOF_WINDOW_SECONDS: Record<ProofOp, number> = {
    "frak-merge-v1": 2 * 60,
    "frak-ensure-v1": 30 * 24 * 60 * 60,
    "frak-install-v1": 30 * 24 * 60 * 60,
};

/** Clock-skew allowance for a future-dated `ts` (README §2.2). */
const MAX_FUTURE_SKEW_SECONDS = 60;

export type ProofCheckParams = {
    op: ProofOp;
    proof: string;
    merchantId: string;
    anonymousId: string;
    /** Raw bytes of the op-specific binding. Empty for ops with none. */
    binding?: Uint8Array;
    /** Unix seconds. Defaults to now. Injected by tests. */
    now?: number;
};

async function importPublicKey(pk: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        pk as BufferSource,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
    );
}

/** Derive the anonymous id the public key claims, per §2.1. */
async function deriveIdFromKey(pk: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", pk as BufferSource);
    return deriveClientIdFromHash(new Uint8Array(digest));
}

function isFresh(ts: number, now: number, windowSeconds: number): boolean {
    if (!Number.isFinite(ts)) return false;
    if (ts > now + MAX_FUTURE_SKEW_SECONDS) return false;
    return ts >= now - windowSeconds;
}

/**
 * Verifies identity proof-of-possession signatures (README §2.1-§2.3).
 *
 * Stateless and pure: no repository, no cross-domain import. It answers one
 * question — "is this proof a valid signature, by the key that derives this
 * id, within this op's window?" — and nothing about identity-graph state
 * (the §4.6 `proofSeen` latch is a separate concern, read by the caller).
 *
 * Verification lives here rather than in the SDK because only the backend
 * ever verifies. The SDK contributes the frozen, shared halves — the
 * canonical byte layout and the derivation — which both sides must agree on
 * to the byte; signing is the SDK's job, verifying is ours.
 *
 * WebCrypto only (native under Bun): every P-256 signature we accept was
 * produced against a curve WebCrypto implements, so there is no fallback
 * path and no reason to pull in `@noble/curves` server-side.
 */
export class IdentityProofService {
    /**
     * Verify a proof, in the order §2.2 mandates:
     *
     *   1. derive id from `pk`  → must equal the claimed `anonymousId`
     *   2. verify sig over the recomposed message
     *   3. check `ts` against the op's window
     *
     * Step 1 is what makes a key registry unnecessary: the claimed id is
     * self-authenticating against the embedded public key, so an attacker
     * cannot submit an arbitrary `pk` and have it accepted for someone
     * else's id.
     */
    async verify(params: ProofCheckParams): Promise<ProofVerification> {
        const result = await this.check(params);

        infraMetrics.identityProofChecked(
            params.op,
            result.valid ? "valid" : "invalid"
        );
        if (!result.valid) {
            // Debug, not info: enforcing callers log their own, more
            // specific rejection line, and the valid/invalid split is
            // already a metric.
            log.debug(
                {
                    op: params.op,
                    merchantId: params.merchantId,
                    anonymousId: params.anonymousId,
                    reason: result.reason,
                },
                "Identity proof rejected"
            );
        }

        return result;
    }

    /**
     * `verify`, but 403s instead of returning a result. Every enforcing
     * caller wants the same two outcomes, so the error code stays identical
     * across the ensure/merge-initiate/merge-execute paths. `context`
     * names the call site, so a rejection stays attributable in the logs.
     */
    async verifyOrThrow(
        params: ProofCheckParams & { context: string }
    ): Promise<void> {
        const result = await this.verify(params);
        if (!result.valid) {
            log.info(
                {
                    op: params.op,
                    merchantId: params.merchantId,
                    anonymousId: params.anonymousId,
                    reason: result.reason,
                },
                `Identity proof rejected on ${params.context}`
            );
            throw HttpError.forbidden(
                "PROOF_INVALID",
                "Identity proof failed verification"
            );
        }
    }

    private async check(params: ProofCheckParams): Promise<ProofVerification> {
        const envelope = decodeProof(params.proof);
        if (!envelope) {
            return { valid: false, reason: "malformed" };
        }

        const derivedId = await deriveIdFromKey(envelope.pk);
        if (derivedId !== params.anonymousId.toLowerCase()) {
            return { valid: false, reason: "id_mismatch" };
        }

        const message = buildProofMessage({
            op: params.op,
            merchantId: params.merchantId,
            anonymousId: params.anonymousId,
            binding: params.binding ?? new Uint8Array(0),
            ts: envelope.ts,
        });

        if (
            !(await this.isSignatureValid(envelope.pk, envelope.sig, message))
        ) {
            return { valid: false, reason: "bad_signature" };
        }

        const now = params.now ?? Math.floor(Date.now() / 1000);
        if (!isFresh(envelope.ts, now, PROOF_WINDOW_SECONDS[params.op])) {
            return { valid: false, reason: "expired" };
        }

        return { valid: true };
    }

    private async isSignatureValid(
        pk: Uint8Array,
        sig: Uint8Array,
        message: Uint8Array
    ): Promise<boolean> {
        try {
            const key = await importPublicKey(pk);
            return await crypto.subtle.verify(
                { name: "ECDSA", hash: "SHA-256" },
                key,
                sig as BufferSource,
                message as BufferSource
            );
        } catch {
            // Malformed key/signature bytes (wrong length, invalid point)
            // surface as a thrown DOMException, not a `false` return.
            return false;
        }
    }

    /** Raw SHA-256 digest of a merge token, for the `frak-merge-v1` binding (§2.2). */
    hashMergeToken(mergeToken: string): Uint8Array {
        return sha256(new TextEncoder().encode(mergeToken));
    }
}
