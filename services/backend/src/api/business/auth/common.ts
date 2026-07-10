import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
// Deep import (bypasses the `@backend-utils` barrel): `siwe.ts` pulls in
// `@backend-infrastructure`'s `viemClient` at module scope, and the barrel is
// eagerly imported by almost every test file before the test-mock setup
// (`test/mock/common.ts`) finishes initializing — re-exporting it through
// the barrel causes a real hoisting-order failure across the whole suite.
import { verifySiweSignature } from "../../../utils/siwe";
import {
    type ResolvedBusinessAuth,
    resolveBusinessAuth,
} from "../middleware/resolveBusinessAuth";

/**
 * Full SIWE verification (parse + domain validation against the request
 * origin + ERC-1271/6492-aware signature check). Returns the proven address.
 * Shared by login, the `siwe` 2FA method and wallet linking. Thin wrapper
 * over the shared `verifySiweSignature` core (`@backend-utils`) that keeps
 * this call site's original `{ address, nonce } | { error }` return shape
 * and logging.
 */
export async function verifySiweProof(params: {
    message: string;
    signature: Hex;
    origin: string;
}): Promise<
    { address: Address; nonce: string | undefined } | { error: string }
> {
    const result = await verifySiweSignature({
        message: params.message,
        signature: params.signature,
        requestOrigin: params.origin,
    });
    if (!result.valid) {
        log.error(
            {
                message: params.message,
                origin: params.origin,
                error: result.error,
            },
            "Invalid SIWE proof"
        );
        return { error: result.error };
    }
    return { address: result.wallet, nonce: result.nonce };
}

/**
 * Resolve the caller's DB-backed session from the `x-business-auth` header.
 * Legacy JWTs are rejected: every route using this helper mutates session or
 * account state, which legacy tokens (no DB row) cannot support — the caller
 * must re-login through SIWE to obtain a DB session.
 *
 * `allowPending` opens the endpoint to 2FA-pending sessions (the 2FA
 * completion surface itself + logout).
 */
export async function requireDbSession(
    headers: Record<string, string | undefined>,
    opts: { allowPending?: boolean } = {}
): Promise<ResolvedBusinessAuth & { accountId: string; sessionId: string }> {
    const token = headers["x-business-auth"];
    if (!token) {
        throw HttpError.unauthorized("UNAUTHORIZED", "Authentication required");
    }
    const auth = await resolveBusinessAuth(token);
    if (!auth?.accountId || !auth.sessionId) {
        throw HttpError.unauthorized(
            "SESSION_REQUIRED",
            "A full session is required — please sign in again"
        );
    }
    if (auth.pending2fa && !opts.allowPending) {
        throw HttpError.unauthorized(
            "TWO_FACTOR_PENDING",
            "Complete two-factor authentication first"
        );
    }
    return auth as ResolvedBusinessAuth & {
        accountId: string;
        sessionId: string;
    };
}
