import { describe, expect, it, vi } from "vitest";
import type { MoneriumConfig } from "../config";
import { MoneriumApiError } from "../errors";
import { MoneriumApiClient, parseSiweLocation } from "./MoneriumApiClient";

const config: MoneriumConfig = {
    clientId: "client-1",
    environment: "sandbox",
    apiBaseUrl: "https://api.monerium.dev",
    chain: "arbitrumsepolia",
    chainId: 421614,
    walletUrl: "https://wallet.test",
    redirectUri: "https://wallet.test/monerium/callback",
    siweDomain: "wallet.test",
    siweEnabled: true,
};

function clientWith(response: Response) {
    const fetchMock = vi.fn(
        async (_url: URL | string, _init?: RequestInit) => response
    );
    return {
        fetchMock,
        client: new MoneriumApiClient(
            fetchMock as unknown as typeof fetch,
            () => config
        ),
    };
}

describe("parseSiweLocation", () => {
    it("reads the authorization code", () => {
        expect(
            parseSiweLocation(
                "https://wallet.test/monerium/callback?code=abc&state=s"
            )
        ).toEqual({ kind: "code", code: "abc" });
    });

    it("reads an error with its description", () => {
        expect(
            parseSiweLocation(
                "https://wallet.test/monerium/callback?error=invalid_request&error_description=No+such+address"
            )
        ).toEqual({
            kind: "error",
            error: "invalid_request",
            description: "No such address",
        });
    });

    it("treats a missing or unusable Location as an error", () => {
        expect(parseSiweLocation(null)).toMatchObject({
            kind: "error",
            error: "missing_location",
        });
        expect(parseSiweLocation("not a url")).toMatchObject({
            kind: "error",
            error: "invalid_location",
        });
        expect(
            parseSiweLocation("https://wallet.test/monerium/callback")
        ).toMatchObject({ kind: "error", error: "missing_code" });
    });
});

describe("MoneriumApiClient", () => {
    it("submits SIWE as a form with a manual redirect and reads the Location", async () => {
        const { client, fetchMock } = clientWith(
            new Response(null, {
                status: 302,
                headers: {
                    location: "https://wallet.test/monerium/callback?code=xyz",
                },
            })
        );

        const outcome = await client.submitSiwe({
            message: "msg",
            signature: "0xabc",
            codeChallenge: "challenge",
            state: "state-1",
        });

        expect(outcome).toEqual({ kind: "code", code: "xyz" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://api.monerium.dev/auth");
        expect(init?.redirect).toBe("manual");
        const headers = init?.headers as Record<string, string>;
        expect(headers["Content-Type"]).toBe(
            "application/x-www-form-urlencoded"
        );
        expect(headers.Accept).toBe("application/vnd.monerium.api-v2+json");
        const form = new URLSearchParams(String(init?.body));
        expect(form.get("authentication_method")).toBe("siwe");
        expect(form.get("client_id")).toBe("client-1");
        expect(form.get("code_challenge_method")).toBe("S256");
    });

    it("turns a 4xx answer to SIWE into a rejection, not an exception", async () => {
        const { client } = clientWith(
            Response.json(
                {
                    code: 400,
                    status: "Bad Request",
                    message: "Invalid signature",
                },
                { status: 400 }
            )
        );
        await expect(
            client.submitSiwe({
                message: "m",
                signature: "0x01",
                codeChallenge: "c",
                state: "s",
            })
        ).resolves.toMatchObject({
            kind: "error",
            description: "Invalid signature",
        });
    });

    it("throws on a SIWE 5xx so it is not recorded as a rejection", async () => {
        const { client } = clientWith(new Response("boom", { status: 503 }));
        await expect(
            client.submitSiwe({
                message: "m",
                signature: "0x01",
                codeChallenge: "c",
                state: "s",
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    it("surfaces 429 with Retry-After", async () => {
        const { client } = clientWith(
            new Response("{}", {
                status: 429,
                headers: { "retry-after": "42" },
            })
        );
        const error = await client.getAuthContext("token").catch((e) => e);
        expect(error).toBeInstanceOf(MoneriumApiError);
        expect(error).toMatchObject({ status: 429, retryAfterSeconds: 42 });
        expect(error.isUpstreamFailure).toBe(true);
    });

    it("maps a transport failure to status 0", async () => {
        const client = new MoneriumApiClient(
            (async () => {
                throw new Error("socket closed");
            }) as unknown as typeof fetch,
            () => config
        );
        const error = await client.getAuthContext("token").catch((e) => e);
        expect(error).toMatchObject({ status: 0 });
        expect(error.isUpstreamFailure).toBe(true);
    });

    it("keeps Monerium's message and OAuth error code", async () => {
        const { client } = clientWith(
            Response.json(
                { error: "invalid_grant", error_description: "Token expired" },
                { status: 400 }
            )
        );
        await expect(client.refreshAccessToken("r")).rejects.toMatchObject({
            status: 400,
            moneriumCode: "invalid_grant",
            message: "Token expired",
        });
    });

    it("sends the refresh grant as a form", async () => {
        const { client, fetchMock } = clientWith(
            Response.json({
                access_token: "a2",
                refresh_token: "r2",
                expires_in: 3600,
            })
        );
        const tokens = await client.refreshAccessToken("r1");
        expect(tokens).toEqual({
            accessToken: "a2",
            refreshToken: "r2",
            expiresInSeconds: 3600,
        });
        const form = new URLSearchParams(
            String(fetchMock.mock.calls[0][1]?.body)
        );
        expect(form.get("grant_type")).toBe("refresh_token");
        expect(form.get("refresh_token")).toBe("r1");
    });

    it("reads a 202 on POST /addresses as accepted and a 201 as created", async () => {
        const accepted = clientWith(
            Response.json({ code: 202, status: "Accepted" }, { status: 202 })
        );
        const created = clientWith(Response.json({}, { status: 201 }));
        const params = {
            profile: "p",
            address: "0x0000000000000000000000000000000000000001",
            chain: "arbitrumsepolia",
            message: "m",
            signature: "0x01",
        } as const;
        await expect(accepted.client.linkAddress("t", params)).resolves.toBe(
            "accepted"
        );
        await expect(created.client.linkAddress("t", params)).resolves.toBe(
            "created"
        );
    });

    it("reads a 202 on POST /orders as accepted and sends the redeem body", async () => {
        const { client, fetchMock } = clientWith(
            Response.json({ code: 202, status: "Accepted" }, { status: 202 })
        );
        const outcome = await client.placeRedeemOrder("t", {
            id: "order-1",
            address: "0x0000000000000000000000000000000000000001",
            chain: "arbitrumsepolia",
            amount: "1",
            iban: "DE89370400440532013000",
            details: { own: true },
            message: "m",
            signature: "0x01",
            memo: "Frak Wallet offramp",
        });
        expect(outcome).toEqual({ kind: "accepted" });
        const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(body).toMatchObject({
            id: "order-1",
            kind: "redeem",
            currency: "eur",
            counterpart: {
                identifier: {
                    standard: "iban",
                    iban: "DE89370400440532013000",
                },
                details: { own: true },
            },
        });
    });
});
