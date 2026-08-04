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
 * Per-op validity windows, seconds. Backend policy, not the frozen wire
 * format, so revisable independently of `canonical.ts`.
 *
 * `frak-ensure-v1`/`frak-install-v1`: 30 days, long enough to cover the
 * install→forget→reopen funnel. `frak-merge-v1`: 2 minutes, a live
 * request-response window.
 */
const PROOF_WINDOW_SECONDS: Record<ProofOp, number> = {
    "frak-merge-v1": 2 * 60,
    "frak-ensure-v1": 30 * 24 * 60 * 60,
    "frak-install-v1": 30 * 24 * 60 * 60,
    // `frak-sso-v1` travels in a URL with no server-issued nonce, so this
    // window is the only thing bounding replay of a captured URL. 10
    // minutes covers a passkey ceremony plus a retry.
    "frak-sso-v1": 10 * 60,
};

/** Clock-skew allowance for a future-dated `ts`. */
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

/** Derive the anonymous id the public key claims. */
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
 * Verifies identity proof-of-possession signatures. Stateless and pure —
 * answers only "is this a valid signature, by the key that derives this id,
 * within this op's window?"; the `proofSeen` latch is a separate concern,
 * read by the caller.
 *
 * WebCrypto only (native under Bun): every P-256 signature we accept was
 * produced against a curve WebCrypto implements.
 */
export class IdentityProofService {
    /**
     * Derive id from `pk` (must equal claimed `anonymousId`), verify the
     * signature, then check `ts` against the op's window. Deriving first is
     * what makes a key registry unnecessary: the id is self-authenticating
     * against the embedded key, so an attacker can't submit an arbitrary
     * `pk` and have it accepted for someone else's id.
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

    /** Raw SHA-256 digest of a merge token, for the `frak-merge-v1` binding. */
    hashMergeToken(mergeToken: string): Uint8Array {
        return sha256(new TextEncoder().encode(mergeToken));
    }
}
