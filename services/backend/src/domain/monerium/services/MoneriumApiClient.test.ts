import { describe, expect, it, vi } from "vitest";
import { asFake, testMoneriumConfig } from "../../../../test/mock/monerium";
import { MoneriumApiError } from "../errors";
import { MoneriumApiClient, parseSiweLocation } from "./MoneriumApiClient";
import { MoneriumRateLimitPause } from "./MoneriumRateLimitPause";

const config = testMoneriumConfig();

function clientWith(response: Response) {
    const fetchMock = vi.fn(
        async (_url: URL | string, _init?: RequestInit) => response
    );
    const rateLimitPause = new MoneriumRateLimitPause();
    return {
        fetchMock,
        rateLimitPause,
        client: new MoneriumApiClient(
            asFake<typeof fetch>(fetchMock),
            () => config,
            rateLimitPause
        ),
    };
}

const siweArgs = {
    message: "m",
    signature: "0x01",
    codeChallenge: "c",
    state: "s",
} as const;

const expected = {
    redirectUri: "https://wallet.test/monerium/callback",
    state: "s",
};

describe("parseSiweLocation", () => {
    it("reads the authorization code", () => {
        expect(
            parseSiweLocation(
                "https://wallet.test/monerium/callback?code=abc&state=s",
                expected
            )
        ).toEqual({ kind: "code", code: "abc" });
    });

    it("reads an error with its description as a rejection", () => {
        expect(
            parseSiweLocation(
                "https://wallet.test/monerium/callback?error=invalid_request&error_description=No+such+address&state=s",
                expected
            )
        ).toEqual({
            kind: "rejected",
            error: "invalid_request",
            description: "No such address",
        });
    });

    it("treats a missing or unusable Location as unexpected", () => {
        expect(parseSiweLocation(null, expected)).toMatchObject({
            kind: "unexpected",
            error: "missing_location",
        });
        expect(parseSiweLocation("not a url", expected)).toMatchObject({
            kind: "unexpected",
            error: "invalid_location",
        });
        expect(
            parseSiweLocation(
                "https://wallet.test/monerium/callback?state=s",
                expected
            )
        ).toMatchObject({ kind: "unexpected", error: "missing_code" });
    });

    it("refuses a redirect to another origin or path", () => {
        for (const location of [
            "https://evil.test/monerium/callback?code=abc&state=s",
            "https://wallet.test/other?code=abc&state=s",
        ]) {
            expect(parseSiweLocation(location, expected)).toEqual({
                kind: "unexpected",
                error: "unexpected_redirect",
            });
        }
    });

    it("refuses a redirect that does not carry our state", () => {
        for (const query of ["code=abc", "code=abc&state=other"]) {
            expect(
                parseSiweLocation(
                    `https://wallet.test/monerium/callback?${query}`,
                    expected
                )
            ).toEqual({ kind: "unexpected", error: "state_mismatch" });
        }
    });
});

describe("MoneriumApiClient", () => {
    it("submits SIWE as a form with a manual redirect and reads the Location", async () => {
        const { client, fetchMock } = clientWith(
            new Response(null, {
                status: 302,
                headers: {
                    location:
                        "https://wallet.test/monerium/callback?code=xyz&state=state-1",
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
        expect(
            Object.fromEntries(new URLSearchParams(String(init?.body)))
        ).toEqual({
            client_id: "client-1",
            redirect_uri: "https://wallet.test/monerium/callback",
            code_challenge: "challenge",
            code_challenge_method: "S256",
            state: "state-1",
            authentication_method: "siwe",
            message: "msg",
            signature: "0xabc",
        });
    });

    it.each([
        ["login", { auth_mode: "login" }],
        [undefined, {}],
    ] as const)(
        "builds the portal URL with auth mode %s",
        (authMode, extra) => {
            const { client } = clientWith(new Response(null));
            const url = new URL(
                client.authorizeUrl({
                    codeChallenge: "challenge",
                    state: "state-1",
                    authMode,
                })
            );
            expect(url.origin + url.pathname).toBe(
                "https://api.monerium.dev/auth"
            );
            expect(Object.fromEntries(url.searchParams)).toEqual({
                client_id: "client-1",
                redirect_uri: "https://wallet.test/monerium/callback",
                response_type: "code",
                code_challenge: "challenge",
                code_challenge_method: "S256",
                state: "state-1",
                ...extra,
            });
        }
    );

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
        await expect(client.submitSiwe(siweArgs)).resolves.toMatchObject({
            kind: "rejected",
            description: "Invalid signature",
        });
    });

    it("reports a 307 to the portal as not eligible", async () => {
        const { client } = clientWith(
            new Response(null, {
                status: 307,
                headers: { location: "https://monerium.app/signup" },
            })
        );
        await expect(client.submitSiwe(siweArgs)).resolves.toEqual({
            kind: "not_eligible",
        });
    });

    it("throws on a SIWE 5xx so it is not recorded as a rejection", async () => {
        const { client } = clientWith(new Response("boom", { status: 503 }));
        await expect(client.submitSiwe(siweArgs)).rejects.toMatchObject({
            status: 503,
        });
    });

    it("surfaces 429 and pauses until Retry-After", async () => {
        const { client, rateLimitPause } = clientWith(
            new Response("{}", {
                status: 429,
                headers: { "retry-after": "42" },
            })
        );
        const error = await client.getAuthContext("token").catch((e) => e);
        expect(error).toBeInstanceOf(MoneriumApiError);
        expect(error).toMatchObject({ status: 429 });
        expect(error.isUpstreamFailure).toBe(true);
        expect(rateLimitPause.isPaused(Date.now() + 41_000)).toBe(true);
        expect(rateLimitPause.isPaused(Date.now() + 43_000)).toBe(false);
    });

    it("shares a 429 pause, defaulting to 60 s without Retry-After", async () => {
        const { client, rateLimitPause } = clientWith(
            new Response("{}", { status: 429 })
        );
        await client.getAuthContext("token").catch(() => undefined);
        expect(rateLimitPause.isPaused(Date.now() + 59_000)).toBe(true);
        expect(rateLimitPause.isPaused(Date.now() + 61_000)).toBe(false);
    });

    it("sends the authorization code with its verifier and the redirect URI", async () => {
        const { client, fetchMock } = clientWith(
            Response.json({
                access_token: "a",
                refresh_token: "r",
                expires_in: 60,
            })
        );
        await client.exchangeAuthorizationCode({
            code: "c1",
            codeVerifier: "v1",
        });
        const init = fetchMock.mock.calls[0][1];
        expect(
            Object.fromEntries(new URLSearchParams(String(init?.body)))
        ).toEqual({
            grant_type: "authorization_code",
            client_id: "client-1",
            code: "c1",
            code_verifier: "v1",
            redirect_uri: "https://wallet.test/monerium/callback",
        });
    });

    it("answers 502 when the token response has no refresh token", async () => {
        const { client } = clientWith(
            Response.json({ access_token: "a", expires_in: 60 })
        );
        await expect(client.refreshAccessToken("r")).rejects.toMatchObject({
            status: 502,
        });
    });

    it("sends the access token as a Bearer header and reads the auth context", async () => {
        const { client, fetchMock } = clientWith(
            Response.json({ userId: "u1", defaultProfile: "p1", extra: true })
        );
        await expect(client.getAuthContext("tok")).resolves.toEqual({
            userId: "u1",
            defaultProfile: "p1",
        });
        const headers = fetchMock.mock.calls[0][1]?.headers as Record<
            string,
            string
        >;
        expect(headers.Authorization).toBe("Bearer tok");
    });

    it("maps profiles with their reason code", async () => {
        const { client } = clientWith(
            Response.json({
                profiles: [
                    {
                        id: "p1",
                        kind: "personal",
                        state: "rejected",
                        name: "Jo",
                        meta: { reasonCode: "compliance" },
                    },
                    { id: "p2", kind: "corporate", state: "approved" },
                ],
            })
        );
        await expect(client.listProfiles("tok")).resolves.toEqual([
            {
                id: "p1",
                kind: "personal",
                state: "rejected",
                reasonCode: "compliance",
            },
            {
                id: "p2",
                kind: "corporate",
                state: "approved",
                reasonCode: undefined,
            },
        ]);
    });

    it("asks for the addresses of one profile on one chain and defaults missing chains", async () => {
        const { client, fetchMock } = clientWith(
            Response.json({ addresses: [{ address: "0x01" }] })
        );
        await expect(
            client.listAddresses("tok", {
                profile: "p1",
                chain: "arbitrumsepolia",
            })
        ).resolves.toEqual([{ address: "0x01", chains: [] }]);
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.pathname).toBe("/addresses");
        expect(Object.fromEntries(url.searchParams)).toEqual({
            chain: "arbitrumsepolia",
            profile: "p1",
        });
    });

    it("maps a transport failure to status 0", async () => {
        const client = new MoneriumApiClient(
            asFake<typeof fetch>(async () => {
                throw new Error("socket closed");
            }),
            () => config,
            new MoneriumRateLimitPause()
        );
        const error = await client.getAuthContext("token").catch((e) => e);
        expect(error).toMatchObject({ status: 0 });
        expect(error.isUpstreamFailure).toBe(true);
    });

    it("answers an unreadable 2xx body as an upstream failure", async () => {
        const { client } = clientWith(
            new Response("<html>gateway</html>", { status: 200 })
        );
        const error = await client.getAuthContext("token").catch((e) => e);
        expect(error).toMatchObject({ status: 502 });
        expect(error.isUpstreamFailure).toBe(true);
    });

    it("maps a failure while reading the body to status 0", async () => {
        const body = new ReadableStream({
            start(controller) {
                controller.error(new Error("reset while reading"));
            },
        });
        const { client } = clientWith(new Response(body, { status: 200 }));
        const error = await client.listProfiles("token").catch((e) => e);
        expect(error).toBeInstanceOf(MoneriumApiError);
        expect(error).toMatchObject({ status: 0 });
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

    it("reads a 202 on POST /addresses as accepted and a 201 as created, whatever the body", async () => {
        const accepted = clientWith(
            Response.json({ code: 202, status: "Accepted" }, { status: 202 })
        );
        const created = clientWith(
            new Response("<html>created</html>", { status: 201 })
        );
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
