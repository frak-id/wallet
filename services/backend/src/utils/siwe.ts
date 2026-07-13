import { viemClient } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

export type SiweVerifyResult =
    | { valid: true; wallet: Address; nonce: string | undefined }
    | { valid: false; error: string };

/**
 * SIWE message freshness bounds (opt-in, see `verifySiweSignature`). No
 * server-side nonce store — replay resistance for the login/link flows comes
 * from requiring a recently-minted message instead (design decision, plan
 * §1.3). Paired-wallet flows need phone unlock + wallet open, so 2 minutes
 * of past skew covers the slowest legitimate ceremony; a small forward skew
 * absorbs client/server clock drift.
 */
const SIWE_MAX_AGE_MS = 2 * 60 * 1000;
const SIWE_MAX_FORWARD_SKEW_MS = 30 * 1000;

/**
 * Parse the claimed signer address out of an (unverified) SIWE message,
 * without checking the signature. Used only by callers whose expected
 * statement is parameterized by the address (registration, ownership
 * transfer) and therefore can't be known until the message is parsed — a
 * mismatched claimed address still fails at the statement or signature
 * check in `verifySiweSignatureWithStatement` right after.
 */
export function parseClaimedSiweAddress(message: string): Address | null {
    return parseSiweMessage(message)?.address ?? null;
}

/**
 * Core SIWE verification shared by every caller that needs "prove control of
 * this wallet right now" (login, `siwe` 2FA, wallet linking, merchant
 * registration, ownership transfer): parse → validate the domain against the
 * request origin → verify the ERC-1271/6492-aware signature. Three call
 * sites previously reimplemented this exact sequence with subtly different
 * error handling; this is the one core, with statement policy left to the
 * caller (registration/transfer pin an exact expected statement, login/2FA
 * accept any well-formed one).
 */
export async function verifySiweSignature(params: {
    message: string;
    signature: Hex;
    requestOrigin: string;
    /**
     * Enforce message freshness via `issuedAt` (login + wallet link, plan
     * §1.3). Off by default so callers with their own replay binding (the
     * `siwe` 2FA path pins a per-session nonce) are unaffected.
     */
    requireFreshness?: boolean;
}): Promise<SiweVerifyResult> {
    const siweMessage = parseSiweMessage(params.message);
    if (!siweMessage?.address) {
        return { valid: false, error: "Invalid SIWE message format" };
    }

    // An absent/malformed Origin header must be a clean validation failure,
    // not an unhandled `new URL("")` TypeError (500).
    let originHost: string;
    try {
        originHost = new URL(params.requestOrigin).host;
    } catch {
        return { valid: false, error: "Missing or invalid Origin header" };
    }

    // Passing `time` lets viem enforce `expirationTime`/`notBefore` when the
    // message carries them.
    const now = new Date();
    const isValid = validateSiweMessage({
        message: siweMessage,
        domain: originHost,
        time: now,
    });
    if (!isValid) {
        return { valid: false, error: "SIWE message validation failed" };
    }

    if (params.requireFreshness) {
        const freshness = checkSiweFreshness(siweMessage.issuedAt, now);
        if (!freshness.valid) return freshness;
    }

    const isValidSignature = await verifyMessage(viemClient, {
        message: params.message,
        signature: params.signature,
        address: siweMessage.address,
    });
    if (!isValidSignature) {
        return { valid: false, error: "Invalid signature" };
    }

    return {
        valid: true,
        wallet: siweMessage.address,
        nonce: siweMessage.nonce,
    };
}

/**
 * Reject SIWE messages whose `issuedAt` is missing, too old, or too far in
 * the future (clock-skew tolerant). See `SIWE_MAX_AGE_MS` for the rationale.
 */
function checkSiweFreshness(
    issuedAt: Date | undefined,
    now: Date
): { valid: true } | { valid: false; error: string } {
    if (!issuedAt) {
        return { valid: false, error: "SIWE message is missing issuedAt" };
    }
    const ageMs = now.getTime() - issuedAt.getTime();
    if (ageMs > SIWE_MAX_AGE_MS) {
        return { valid: false, error: "SIWE message has expired" };
    }
    if (ageMs < -SIWE_MAX_FORWARD_SKEW_MS) {
        return {
            valid: false,
            error: "SIWE message issuedAt is in the future",
        };
    }
    return { valid: true };
}

/**
 * Statement-pinned variant for flows that mint the SIWE message server-side
 * (registration, ownership transfer): the signed statement must match
 * exactly one of the expected candidates, checked before the (expensive)
 * signature verification.
 */
export async function verifySiweSignatureWithStatement(params: {
    message: string;
    signature: Hex;
    requestOrigin: string;
    expectedStatements: string[];
}): Promise<SiweVerifyResult> {
    const siweMessage = parseSiweMessage(params.message);
    if (!siweMessage?.statement) {
        return { valid: false, error: "Invalid SIWE message format" };
    }
    if (!params.expectedStatements.includes(siweMessage.statement)) {
        return {
            valid: false,
            error: "SIWE statement does not match expected statement",
        };
    }
    return verifySiweSignature(params);
}
