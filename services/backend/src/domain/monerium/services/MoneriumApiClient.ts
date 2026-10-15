import type {
    MoneriumOrderState,
    MoneriumProfileState,
} from "@frak-labs/app-essentials/monerium";
import type { Address, Hex } from "viem";
import { type MoneriumConfig, requireMoneriumConfig } from "../config";
import { MoneriumApiError } from "../errors";

const REQUEST_TIMEOUT_MS = 10_000;
const ACCEPT_HEADER = "application/vnd.monerium.api-v2+json";

export type MoneriumTokenResponse = {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
};

export type MoneriumProfileSummary = {
    id: string;
    kind: "personal" | "corporate";
    state: MoneriumProfileState;
    reasonCode?: string;
};

export type MoneriumUserContext = {
    userId: string;
    defaultProfile?: string;
    profiles: MoneriumProfileSummary[];
};

export type MoneriumAddressRecord = {
    profile?: string;
    address: string;
    chains: string[];
};

export type MoneriumOrderDetails = {
    own?: boolean;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    country?: string;
    name?: string;
};

export type MoneriumOrderRecord = {
    id: string;
    kind: "issue" | "redeem";
    address: Address;
    chain: string;
    currency: string;
    amount: string;
    counterpart: {
        identifier?: { standard?: string; iban?: string };
        details?: MoneriumOrderDetails;
    };
    memo?: string;
    state: MoneriumOrderState;
    meta: {
        placedAt: string;
        processedAt?: string;
        rejectedReason?: string;
        txHashes?: Hex[];
    };
};

export type MoneriumRedeemOrderRequest = {
    id: string;
    address: Address;
    chain: string;
    amount: string;
    iban: string;
    details:
        | { own: true }
        | { firstName: string; lastName: string; country: string };
    message: string;
    signature: Hex;
    memo: string;
};

export type MoneriumSiweOutcome =
    | { kind: "code"; code: string }
    | { kind: "error"; error: string; description?: string };

type RequestOptions = {
    method: "GET" | "POST";
    accessToken?: string;
    query?: Record<string, string>;
    form?: Record<string, string>;
    json?: unknown;
    redirect?: "manual" | "follow";
};

/** Reads the OAuth result off the redirect Monerium answers to a SIWE `POST /auth`. */
export function parseSiweLocation(
    location: string | null
): MoneriumSiweOutcome {
    if (!location) return { kind: "error", error: "missing_location" };
    let url: URL;
    try {
        url = new URL(location);
    } catch {
        return { kind: "error", error: "invalid_location" };
    }
    const error = url.searchParams.get("error");
    if (error) {
        return {
            kind: "error",
            error,
            description: url.searchParams.get("error_description") ?? undefined,
        };
    }
    const code = url.searchParams.get("code");
    if (!code) return { kind: "error", error: "missing_code" };
    return { kind: "code", code };
}

function parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

type ErrorBody = {
    code?: number | string;
    message?: string;
    error?: string;
    error_description?: string;
};

async function toApiError(response: Response): Promise<MoneriumApiError> {
    let body: ErrorBody = {};
    try {
        body = (await response.json()) as ErrorBody;
    } catch {
        // Empty or non-JSON error bodies carry no extra detail.
    }
    const message =
        body.message ??
        body.error_description ??
        body.error ??
        `Monerium answered ${response.status}`;
    const code = body.error ?? (body.code ? String(body.code) : undefined);
    return new MoneriumApiError(
        response.status,
        code,
        message,
        parseRetryAfter(response.headers.get("retry-after"))
    );
}

/** Hand-written client: the official SDK cannot read a manual redirect or tell a 202 from a 200. */
export class MoneriumApiClient {
    constructor(
        private readonly fetchImpl: typeof fetch,
        private readonly getConfig: () => MoneriumConfig = requireMoneriumConfig
    ) {}

    private async send(
        path: string,
        options: RequestOptions
    ): Promise<Response> {
        const config = this.getConfig();
        const url = new URL(path, config.apiBaseUrl);
        for (const [key, value] of Object.entries(options.query ?? {})) {
            url.searchParams.set(key, value);
        }

        const headers: Record<string, string> = { Accept: ACCEPT_HEADER };
        if (options.accessToken) {
            headers.Authorization = `Bearer ${options.accessToken}`;
        }
        let body: string | undefined;
        if (options.form) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            body = new URLSearchParams(options.form).toString();
        } else if (options.json !== undefined) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(options.json);
        }

        try {
            return await this.fetchImpl(url, {
                method: options.method,
                headers,
                body,
                redirect: options.redirect ?? "follow",
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (error) {
            throw new MoneriumApiError(
                0,
                undefined,
                error instanceof Error ? error.message : "Monerium unreachable"
            );
        }
    }

    private async requestJson<T>(
        path: string,
        options: RequestOptions
    ): Promise<{ status: number; body: T }> {
        const response = await this.send(path, options);
        if (!response.ok) throw await toApiError(response);
        const text = await response.text();
        if (!text) return { status: response.status, body: {} as T };
        try {
            return { status: response.status, body: JSON.parse(text) as T };
        } catch {
            throw new MoneriumApiError(
                response.status,
                undefined,
                "Monerium answered with invalid JSON"
            );
        }
    }

    private async requestToken(
        form: Record<string, string>
    ): Promise<MoneriumTokenResponse> {
        const { body } = await this.requestJson<{
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
        }>("/auth/token", { method: "POST", form });
        if (!body.access_token || !body.refresh_token) {
            throw new MoneriumApiError(
                502,
                undefined,
                "Monerium token response is incomplete"
            );
        }
        return {
            accessToken: body.access_token,
            refreshToken: body.refresh_token,
            expiresInSeconds: body.expires_in ?? 3600,
        };
    }

    exchangeAuthorizationCode(params: {
        code: string;
        codeVerifier: string;
    }): Promise<MoneriumTokenResponse> {
        const config = this.getConfig();
        return this.requestToken({
            grant_type: "authorization_code",
            client_id: config.clientId,
            code: params.code,
            code_verifier: params.codeVerifier,
            redirect_uri: config.redirectUri,
        });
    }

    refreshAccessToken(refreshToken: string): Promise<MoneriumTokenResponse> {
        return this.requestToken({
            grant_type: "refresh_token",
            client_id: this.getConfig().clientId,
            refresh_token: refreshToken,
        });
    }

    /** Never throws on a rejected signature: the caller records it. Upstream failures do throw. */
    async submitSiwe(params: {
        message: string;
        signature: Hex;
        codeChallenge: string;
        state: string;
    }): Promise<MoneriumSiweOutcome> {
        const config = this.getConfig();
        const response = await this.send("/auth", {
            method: "POST",
            redirect: "manual",
            form: {
                client_id: config.clientId,
                code_challenge: params.codeChallenge,
                code_challenge_method: "S256",
                authentication_method: "siwe",
                redirect_uri: config.redirectUri,
                message: params.message,
                signature: params.signature,
                state: params.state,
            },
        });

        if (response.status >= 300 && response.status < 400) {
            return parseSiweLocation(response.headers.get("location"));
        }
        const failure = await toApiError(response);
        if (failure.isUpstreamFailure) throw failure;
        return {
            kind: "error",
            error: failure.moneriumCode ?? `http_${response.status}`,
            description: failure.message,
        };
    }

    async getAuthContext(accessToken: string): Promise<MoneriumUserContext> {
        const { body } = await this.requestJson<{
            userId?: string;
            defaultProfile?: string;
            profiles?: MoneriumProfileWire[];
        }>("/auth/context", { method: "GET", accessToken });
        return {
            userId: body.userId ?? "",
            defaultProfile: body.defaultProfile,
            profiles: (body.profiles ?? []).map(toProfileSummary),
        };
    }

    async listProfiles(accessToken: string): Promise<MoneriumProfileSummary[]> {
        const { body } = await this.requestJson<{
            profiles?: MoneriumProfileWire[];
        }>("/profiles", { method: "GET", accessToken });
        return (body.profiles ?? []).map(toProfileSummary);
    }

    async listAddresses(
        accessToken: string,
        params: { profile?: string; chain: string }
    ): Promise<MoneriumAddressRecord[]> {
        const query: Record<string, string> = { chain: params.chain };
        if (params.profile) query.profile = params.profile;
        const { body } = await this.requestJson<{
            addresses?: MoneriumAddressRecord[];
        }>("/addresses", { method: "GET", accessToken, query });
        return (body.addresses ?? []).map((record) => ({
            ...record,
            chains: record.chains ?? [],
        }));
    }

    async linkAddress(
        accessToken: string,
        params: {
            profile: string;
            address: Address;
            chain: string;
            message: string;
            signature: Hex;
        }
    ): Promise<"created" | "accepted"> {
        const { status } = await this.requestJson<unknown>("/addresses", {
            method: "POST",
            accessToken,
            json: params,
        });
        return status === 202 ? "accepted" : "created";
    }

    /** 200 returns the order, 202 means Monerium still waits on an on-chain signature. */
    async placeRedeemOrder(
        accessToken: string,
        request: MoneriumRedeemOrderRequest
    ): Promise<
        { kind: "order"; order: MoneriumOrderRecord } | { kind: "accepted" }
    > {
        const { status, body } = await this.requestJson<MoneriumOrderRecord>(
            "/orders",
            {
                method: "POST",
                accessToken,
                json: {
                    id: request.id,
                    kind: "redeem",
                    address: request.address,
                    currency: "eur",
                    chain: request.chain,
                    amount: request.amount,
                    counterpart: {
                        identifier: {
                            standard: "iban",
                            iban: request.iban,
                        },
                        details: request.details,
                    },
                    message: request.message,
                    signature: request.signature,
                    memo: request.memo,
                },
            }
        );
        if (status === 202 || !body.id) return { kind: "accepted" };
        return { kind: "order", order: body };
    }

    async getOrder(
        accessToken: string,
        orderId: string
    ): Promise<MoneriumOrderRecord> {
        const { body } = await this.requestJson<MoneriumOrderRecord>(
            `/orders/${encodeURIComponent(orderId)}`,
            { method: "GET", accessToken }
        );
        return body;
    }

    async listOrders(
        accessToken: string,
        params: { address: Address }
    ): Promise<MoneriumOrderRecord[]> {
        const { body } = await this.requestJson<{
            orders?: MoneriumOrderRecord[];
        }>("/orders", {
            method: "GET",
            accessToken,
            query: { address: params.address },
        });
        return body.orders ?? [];
    }
}

type MoneriumProfileWire = {
    id: string;
    kind: "personal" | "corporate";
    state: MoneriumProfileState;
    meta?: { reasonCode?: string };
};

function toProfileSummary(wire: MoneriumProfileWire): MoneriumProfileSummary {
    return {
        id: wire.id,
        kind: wire.kind,
        state: wire.state,
        reasonCode: wire.meta?.reasonCode,
    };
}
