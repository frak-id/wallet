import { moneriumConfig } from "@/module/monerium/utils/moneriumConfig";
import type {
    MoneriumIbansResponse,
    MoneriumNewOrder,
    MoneriumOrder,
    MoneriumProfilesResponse,
    MoneriumTokenResponse,
} from "@/module/monerium/utils/moneriumTypes";

function getErrorMessage(payload: unknown): string {
    if (typeof payload === "string") {
        return payload;
    }

    if (typeof payload === "object" && payload !== null) {
        const json = payload as Record<string, unknown>;

        if (typeof json.message === "string") {
            return json.message;
        }

        if (typeof json.error_description === "string") {
            return json.error_description;
        }

        if (typeof json.error === "string") {
            return json.error;
        }

        if (typeof json.title === "string") {
            return json.title;
        }

        if (typeof json.detail === "string") {
            return json.detail;
        }
    }

    return "Request failed";
}

async function readErrorMessage(response: Response): Promise<string> {
    try {
        const payload = await response.json();
        return getErrorMessage(payload);
    } catch {
        return response.statusText || "Request failed";
    }
}

async function throwMoneriumError(response: Response): Promise<never> {
    const message = await readErrorMessage(response);

    if (response.status === 401) {
        throw new Error(`Monerium API 401: ${message}`);
    }

    throw new Error(`Monerium API ${response.status}: ${message}`);
}

export function getApiBaseUrl(): string {
    return moneriumConfig.environment === "production"
        ? "https://api.monerium.app"
        : "https://api.monerium.dev";
}

async function moneriumFetch<T>(
    path: string,
    accessToken: string,
    options?: RequestInit
): Promise<T> {
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/vnd.monerium.api-v2+json");
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        return throwMoneriumError(response);
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
        return throwMoneriumError(response);
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
        return throwMoneriumError(response);
    }

    return (await response.json()) as MoneriumTokenResponse;
}

export async function getProfiles(
    accessToken: string
): Promise<MoneriumProfilesResponse> {
    return moneriumFetch<MoneriumProfilesResponse>("/profiles", accessToken);
}

export async function getIbans(
    accessToken: string
): Promise<MoneriumIbansResponse> {
    return moneriumFetch<MoneriumIbansResponse>("/ibans", accessToken);
}

export async function placeOrder(
    accessToken: string,
    order: MoneriumNewOrder
): Promise<MoneriumOrder> {
    return moneriumFetch<MoneriumOrder>("/orders", accessToken, {
        method: "POST",
        body: JSON.stringify({
            kind: "redeem",
            ...order,
        }),
    });
}
