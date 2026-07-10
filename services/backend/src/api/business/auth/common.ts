import { log, viemClient } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import {
    type ResolvedBusinessAuth,
    resolveBusinessAuth,
} from "../middleware/resolveBusinessAuth";

/**
 * Full SIWE verification (parse + domain validation against the request
 * origin + ERC-1271/6492-aware signature check). Returns the proven address.
 * Shared by login, the `siwe` 2FA method and wallet linking.
 */
export async function verifySiweProof(params: {
    message: string;
    signature: Hex;
    origin: string;
}): Promise<
    { address: Address; nonce: string | undefined } | { error: string }
> {
    const siweMessage = parseSiweMessage(params.message);
    if (!siweMessage?.address) {
        return { error: "Invalid SIWE message" };
    }

    let originHost: string;
    try {
        originHost = new URL(params.origin).host;
    } catch {
        return { error: "Invalid origin" };
    }
    const isValid = validateSiweMessage({
        message: siweMessage,
        domain: originHost,
    });
    if (!isValid) {
        log.error(
            { siweMessage, origin: params.origin },
            "Invalid SIWE message"
        );
        return { error: "Invalid SIWE message" };
    }

    const isValidSignature = await verifyMessage(viemClient, {
        message: params.message,
        signature: params.signature,
        address: siweMessage.address,
    });
    if (!isValidSignature) {
        log.error(
            { signature: params.signature, message: params.message },
            "Invalid SIWE signature"
        );
        return { error: "Invalid signature" };
    }

    return { address: siweMessage.address, nonce: siweMessage.nonce };
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
