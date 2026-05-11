import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { recordError } from "@frak-labs/wallet-shared";
import type { Address, Hex } from "viem";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { moneriumConfig } from "@/module/monerium/utils/moneriumConfig";
import type {
    MoneriumAddressesResponse,
    MoneriumNewOrder,
    MoneriumOrder,
    MoneriumPostAddressResponse,
    MoneriumProfilesResponse,
    MoneriumTokenResponse,
} from "@/module/monerium/utils/moneriumTypes";

export class MoneriumApiError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = "MoneriumApiError";
    }
}

/** TanStack Query `retry` predicate. 4xx never retried; 5xx + network do. */
export function isMoneriumRetryable(error: unknown): boolean {
    if (error instanceof MoneriumApiError) return error.status >= 500;
    return true;
}

/** Refresh proactively when the access token has < this much life left. */
const TOKEN_REFRESH_GRACE_MS = 60_000;
const REFRESH_MAX_ATTEMPTS = 3;
const REFRESH_BASE_DELAY_MS = 500;

let activeRefresh: Promise<void> | null = null;

function getApiBaseUrl(): string {
    // Production Tauri builds load bundled assets from `tauri://localhost`
    // (iOS) / `https://tauri.localhost` (Android), so a relative
    // `/monerium-api/...` would resolve against the local scheme and 404.
    // Route through the deployed wallet's nginx proxy at FRAK_WALLET_URL.
    // (See apps/wallet/nginx.conf — the `/monerium-api/` location allows
    // Tauri origins via CORS reflection.) Tauri dev (devUrl runs vite on
    // localhost) falls through to the relative path so the vite proxy wins.
    if (IS_TAURI && typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host !== "localhost" && host !== "127.0.0.1") {
            return `${process.env.FRAK_WALLET_URL}/monerium-api`;
        }
    }
    // Web (localhost dev or deployed) — relative path is proxied by vite
    // (dev) or by the wallet pod's nginx (deployed).
    return "/monerium-api";
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function handleNonOk(response: Response): Promise<never> {
    let message = response.statusText || "Request failed";
    try {
        const body = await response.json();
        message =
            body?.message ?? body?.error_description ?? body?.error ?? message;
    } catch {}
    throw new MoneriumApiError(
        response.status,
        `Monerium API ${response.status}: ${message}`
    );
}

export async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string
): Promise<MoneriumTokenResponse> {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: moneriumConfig.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: moneriumConfig.redirectUri,
    }).toString();

    const response = await fetch(`${getApiBaseUrl()}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!response.ok) await handleNonOk(response);
    return (await response.json()) as MoneriumTokenResponse;
}

/**
 * Coalesces concurrent callers onto a single in-flight refresh promise so we
 * never fire two `/auth/token` requests in parallel.
 */
export async function refreshAccessToken(): Promise<void> {
    if (activeRefresh) return activeRefresh;
    activeRefresh = doRefreshWithBackoff().finally(() => {
        activeRefresh = null;
    });
    return activeRefresh;
}

async function doRefreshWithBackoff(): Promise<void> {
    const { refreshToken } = moneriumStore.getState();
    if (!refreshToken) {
        moneriumStore.getState().disconnect();
        throw new MoneriumApiError(401, "Monerium unauthorized");
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: moneriumConfig.clientId,
        refresh_token: refreshToken,
    }).toString();

    let lastError: unknown;
    for (let attempt = 1; attempt <= REFRESH_MAX_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(`${getApiBaseUrl()}/auth/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });
            if (!response.ok) await handleNonOk(response);
            const tokens = (await response.json()) as MoneriumTokenResponse;
            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in
                );
            return;
        } catch (error) {
            lastError = error;

            // 4xx auth failure: refresh token is dead, terminal.
            if (
                error instanceof MoneriumApiError &&
                (error.status === 400 || error.status === 401)
            ) {
                moneriumStore.getState().disconnect();
                throw error;
            }

            // Transient (5xx / network): backoff and retry.
            if (attempt < REFRESH_MAX_ATTEMPTS) {
                await delay(REFRESH_BASE_DELAY_MS * 2 ** (attempt - 1));
            }
        }
    }

    moneriumStore.getState().disconnect();
    throw lastError ?? new MoneriumApiError(401, "Monerium unauthorized");
}

async function ensureValidToken(): Promise<string> {
    const { accessToken, refreshToken, tokenExpiry } = moneriumStore.getState();
    if (!accessToken) {
        throw new MoneriumApiError(401, "Monerium unauthorized");
    }
    const needsRefresh =
        tokenExpiry !== null &&
        Date.now() >= tokenExpiry - TOKEN_REFRESH_GRACE_MS;
    if (!needsRefresh) return accessToken;

    if (!refreshToken) {
        moneriumStore.getState().disconnect();
        throw new MoneriumApiError(401, "Monerium unauthorized");
    }
    await refreshAccessToken();

    const refreshed = moneriumStore.getState().accessToken;
    if (!refreshed) throw new MoneriumApiError(401, "Monerium unauthorized");
    return refreshed;
}

async function moneriumFetch<T>(
    path: string,
    options?: RequestInit,
    // Internal recursion guard — callers must not pass this.
    hasRetried = false
): Promise<T> {
    try {
        const accessToken = await ensureValidToken();

        const headers = new Headers(options?.headers);
        headers.set("Authorization", `Bearer ${accessToken}`);
        headers.set("Accept", "application/vnd.monerium.api-v2+json");
        headers.set("Content-Type", "application/json");

        const response = await fetch(`${getApiBaseUrl()}${path}`, {
            ...options,
            headers,
        });

        if (response.ok) return (await response.json()) as T;

        // Refresh once on 401 and retry the original request transparently.
        if (response.status === 401 && !hasRetried) {
            await refreshAccessToken();
            return moneriumFetch<T>(path, options, true);
        }

        return handleNonOk(response);
    } catch (err) {
        // Log only at the outer call to avoid double-reporting on the
        // 401-refresh-retry path.
        if (!hasRetried) {
            recordError(err, { source: "monerium_api", context: { path } });
        }
        throw err;
    }
}

export async function getProfiles(): Promise<MoneriumProfilesResponse> {
    return moneriumFetch<MoneriumProfilesResponse>("/profiles");
}

export async function getAddresses(): Promise<MoneriumAddressesResponse> {
    return moneriumFetch<MoneriumAddressesResponse>("/addresses");
}

export async function linkAddress(params: {
    profile: string;
    address: Address;
    chain: string;
    message: string;
    signature: Hex;
}): Promise<MoneriumPostAddressResponse> {
    return moneriumFetch<MoneriumPostAddressResponse>("/addresses", {
        method: "POST",
        body: JSON.stringify(params),
    });
}

export async function placeOrder(
    order: MoneriumNewOrder
): Promise<MoneriumOrder> {
    return moneriumFetch<MoneriumOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({ kind: "redeem", ...order }),
    });
}

// TODO(monerium-orders-monitoring): wire `GET /orders` and `GET /orders/{id}`
// into the wallet history module so users can see redeem state transitions
// (placed → pending → processed | rejected) and the on-chain burn tx hash.
// Per Monerium's docs the canonical pattern is:
//   1. Listen for ERC-20 Transfer events on the EURe token (mint = incoming
//      SEPA, burn = outgoing SEPA) — addresses come from `GET /tokens`.
//   2. On a matched event, fetch the order once via `GET /orders?txHash=...`
//      (do NOT poll in a loop).
// Tracked separately from this PR.
