import type { Address, Hex } from "viem";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { moneriumConfig } from "@/module/monerium/utils/moneriumConfig";
import type {
    MoneriumAddressesResponse,
    MoneriumIbansResponse,
    MoneriumNewOrder,
    MoneriumOrder,
    MoneriumPostAddressResponse,
    MoneriumProfilesResponse,
    MoneriumTokenResponse,
} from "@/module/monerium/utils/moneriumTypes";

async function throwApiError(response: Response): Promise<never> {
    let message = response.statusText || "Request failed";
    try {
        const body = await response.json();
        message =
            body?.message ?? body?.error_description ?? body?.error ?? message;
    } catch {}

    throw new Error(`Monerium API ${response.status}: ${message}`);
}

function getApiBaseUrl(): string {
    // Dev: proxy via vite (`/monerium-api/*`) since the sandbox doesn't
    // whitelist localhost origins. The vite proxy target is hard-coded to
    // `api.monerium.dev` — `bun dev` always hits sandbox regardless of
    // `moneriumConfig.environment`. Prod builds hit Monerium directly.
    if (import.meta.env.DEV) {
        return "/monerium-api";
    }
    return moneriumConfig.environment === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";
}

function getAccessToken(): string {
    const token = moneriumStore.getState().accessToken;
    if (!token) {
        throw new Error("Monerium: no access token");
    }
    return token;
}

async function moneriumFetch<T>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const accessToken = getAccessToken();
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/vnd.monerium.api-v2+json");
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        return throwApiError(response);
    }

    return (await response.json()) as T;
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
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!response.ok) {
        return throwApiError(response);
    }

    return (await response.json()) as MoneriumTokenResponse;
}

export async function refreshAccessToken(
    refreshToken: string
): Promise<MoneriumTokenResponse> {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: moneriumConfig.clientId,
        refresh_token: refreshToken,
    }).toString();

    const response = await fetch(`${getApiBaseUrl()}/auth/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!response.ok) {
        return throwApiError(response);
    }

    return (await response.json()) as MoneriumTokenResponse;
}

export async function getProfiles(): Promise<MoneriumProfilesResponse> {
    return moneriumFetch<MoneriumProfilesResponse>("/profiles");
}

export async function getIbans(): Promise<MoneriumIbansResponse> {
    return moneriumFetch<MoneriumIbansResponse>("/ibans");
}

export async function placeOrder(
    order: MoneriumNewOrder
): Promise<MoneriumOrder> {
    return moneriumFetch<MoneriumOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
            kind: "redeem",
            ...order,
        }),
    });
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
