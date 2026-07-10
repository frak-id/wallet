import { viemClient } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

export type SiweVerifyResult =
    | { valid: true; wallet: Address; nonce: string | undefined }
    | { valid: false; error: string };

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

    const isValid = validateSiweMessage({
        message: siweMessage,
        domain: originHost,
    });
    if (!isValid) {
        return { valid: false, error: "SIWE message validation failed" };
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
