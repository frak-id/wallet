/**
 * Framework-agnostic SDK session renewal — the ONLY renewal path.
 *
 * No /isValid probe, no fromWebAuthNSignature replay.
 * Authority principle: the server 401 on /generate is the sole signal that
 * the wallet token is truly dead. Transient 5xx / network errors keep the
 * last known SDK token and return "stale" so callers never logout on flaky
 * network.
 */
import { sessionStore } from "../../stores/sessionStore";
import type { SdkSession } from "../../types/Session";
import { authenticatedWalletApi } from "../api/backendClient";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";
import {
    expiresWithinMs,
    getTokenExpMs,
    SDK_RENEW_BEFORE_MS,
} from "../utils/tokenExpiry";

export type FreshSdkResult =
    /** Token is healthy or was successfully reminted. */
    | { status: "fresh"; sdk: SdkSession }
    /** Transient failure (5xx / network offline). Keep last token, do NOT logout. */
    | { status: "stale"; sdk: SdkSession | null }
    /** Server-confirmed: wallet token is dead or no wallet session exists. */
    | { status: "dead" };

/** No-op when token is unchanged — avoids sessionStore.subscribe churn. */
function setSdkSessionIfChanged(next: SdkSession): void {
    const current = sessionStore.getState().sdkSession;
    if (current?.token === next.token) return;
    sessionStore.getState().setSdkSession(next);
}

// True module-level single-flight — shared by Ring-0 (listener) and Ring-1
// (react-query) callers. react-query's per-component dedupe does NOT cover
// the vanilla Ring-0 path.
let inFlight: Promise<FreshSdkResult> | null = null;

async function _run(): Promise<FreshSdkResult> {
    const current = getSafeSdkSession();

    // Token is healthy (decodable AND not near expiry) — return immediately
    // without a network call. An undecodable/corrupt token fails through to the
    // remint path: expiresWithinMs fails open, so we must explicitly require a
    // decodable expiry here, otherwise a garbage token is cached as "fresh".
    if (
        current &&
        getTokenExpMs(current.token) !== null &&
        !expiresWithinMs(current.token, SDK_RENEW_BEFORE_MS)
    ) {
        return { status: "fresh", sdk: current };
    }

    // No wallet session at all — nothing to mint from.
    const wallet = getSafeSession();
    if (!wallet) {
        return { status: "dead" };
    }

    // Attempt remint. Do NOT gate on client-side isExpired(wallet.token):
    // let the server decide (authority principle).
    const { data, error } =
        await authenticatedWalletApi.auth.sdk.generate.get();

    if (data) {
        setSdkSessionIfChanged(data);
        return { status: "fresh", sdk: data };
    }

    if (error?.status === 401) {
        // Server confirmed the wallet token is dead.
        return { status: "dead" };
    }

    // 5xx / network / offline — transient. Keep current (possibly stale) token.
    return { status: "stale", sdk: current };
}

/**
 * Ensure the SDK session is fresh. Returns a discriminated result:
 * - "fresh"  → use sdk token normally
 * - "stale"  → transient failure; sdk may be null or the old token; do NOT logout
 * - "dead"   → server-confirmed; caller should treat as not-connected
 *
 * Multiple concurrent callers share a single in-flight request.
 */
export function ensureFreshSdkSession(): Promise<FreshSdkResult> {
    inFlight ??= _run().finally(() => {
        inFlight = null;
    });
    return inFlight;
}
