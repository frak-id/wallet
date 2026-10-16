import { log } from "@backend-infrastructure";
import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import type { MoneriumPendingAuthRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumPendingAuthRepository } from "../repositories/MoneriumPendingAuthRepository";
import type { MoneriumTrackedOrderRepository } from "../repositories/MoneriumTrackedOrderRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import { MoneriumAuthService } from "./MoneriumAuthService";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import { MoneriumTokenCipher } from "./MoneriumTokenCipher";
import { codeChallengeS256 } from "./pkce";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;
const OTHER = "0x00000000000000000000000000000000000000bb" as const;
const DAY_MS = 24 * 60 * 60_000;
const cipher = new MoneriumTokenCipher(new AdminWalletsRepository());

const STATUS = {
    connection: "connected",
    profile: null,
    walletLink: "none",
    silentReconnect: false,
    environment: "sandbox",
} as const;

function setup(options: { connection?: object | undefined } = {}) {
    const pending = new Map<string, MoneriumPendingAuthRow>();
    const connections = {
        findByWallet: vi.fn(async () => options.connection),
        upsertConnected: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
        deleteByWallet: vi.fn(async () => undefined),
    };
    const pendingAuths = {
        create: vi.fn(
            async (row: Omit<MoneriumPendingAuthRow, "createdAt">) => {
                pending.set(row.state, { ...row, createdAt: new Date() });
            }
        ),
        consume: vi.fn(async (state: string, wallet: string) => {
            const row = pending.get(state);
            if (!row || row.wallet !== wallet) return undefined;
            pending.delete(state);
            return row;
        }),
        deleteByWallet: vi.fn(async () => undefined),
    };
    const trackedOrders = { deleteByWallet: vi.fn(async () => undefined) };
    const client = {
        exchangeAuthorizationCode: vi.fn(async () => ({
            accessToken: "access",
            refreshToken: "refresh",
            expiresInSeconds: 3600,
        })),
        submitSiwe: vi.fn(),
    };
    const status = { getStatus: vi.fn(async () => STATUS) };
    const service = new MoneriumAuthService(
        connections as unknown as MoneriumConnectionRepository,
        pendingAuths as unknown as MoneriumPendingAuthRepository,
        trackedOrders as unknown as MoneriumTrackedOrderRepository,
        cipher,
        client as unknown as MoneriumApiClient,
        status as unknown as MoneriumStatusService
    );
    return {
        service,
        connections,
        pendingAuths,
        trackedOrders,
        client,
        status,
        pending,
    };
}

describe("MoneriumAuthService", () => {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
        vi.stubEnv("MONERIUM_SIWE_ENABLED", "");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("start", () => {
        it("builds the portal URL with PKCE and no address, signature or chain", async () => {
            const { service, pending } = setup();
            const { url } = await service.start({
                wallet: WALLET,
                authMode: "login",
            });
            const params = new URL(url).searchParams;

            expect(new URL(url).origin + new URL(url).pathname).toBe(
                "https://api.monerium.dev/auth"
            );
            expect(params.get("client_id")).toBe("client-1");
            expect(params.get("redirect_uri")).toBe(
                "https://wallet.test/monerium/callback"
            );
            expect(params.get("response_type")).toBe("code");
            expect(params.get("code_challenge_method")).toBe("S256");
            expect(params.get("auth_mode")).toBe("login");
            for (const forbidden of [
                "address",
                "signature",
                "chain",
                "skip_kyc",
            ]) {
                expect(params.has(forbidden)).toBe(false);
            }

            const state = params.get("state") ?? "";
            const stored = pending.get(state);
            expect(stored).toMatchObject({ wallet: WALLET, method: "oauth" });
            const verifier = await cipher.decrypt(
                stored?.codeVerifierEncrypted ?? "",
                WALLET,
                "code_verifier_encrypted"
            );
            expect(codeChallengeS256(verifier)).toBe(
                params.get("code_challenge")
            );
            const ttl = (stored?.expiresAt.getTime() ?? 0) - Date.now();
            expect(ttl).toBeGreaterThan(29 * 60_000);
            expect(ttl).toBeLessThanOrEqual(30 * 60_000);
        });

        it("omits auth_mode when not asked", async () => {
            const { service } = setup();
            const { url } = await service.start({ wallet: WALLET });
            expect(new URL(url).searchParams.has("auth_mode")).toBe(false);
        });
    });

    describe("handleCallback", () => {
        async function started() {
            const ctx = setup();
            const { url } = await ctx.service.start({ wallet: WALLET });
            return {
                ...ctx,
                state: new URL(url).searchParams.get("state") ?? "",
            };
        }

        it("exchanges the code with the stored verifier and stores encrypted tokens", async () => {
            const { service, client, connections, state } = await started();

            const result = await service.handleCallback({
                wallet: WALLET,
                code: "c1",
                state,
            });

            expect(result).toEqual(STATUS);
            expect(connections.upsertConnected).toHaveBeenCalledWith(
                expect.objectContaining({ clearSiweFailure: true })
            );
            const exchange = client.exchangeAuthorizationCode.mock
                .calls[0] as unknown as [
                { code: string; codeVerifier: string },
            ];
            expect(exchange[0].code).toBe("c1");
            expect(exchange[0].codeVerifier.length).toBeGreaterThanOrEqual(43);
            const saved = connections.upsertConnected.mock
                .calls[0] as unknown as [
                { accessTokenEncrypted: string; refreshTokenEncrypted: string },
            ];
            expect(
                await cipher.decrypt(
                    saved[0].accessTokenEncrypted,
                    WALLET,
                    "access_token_encrypted"
                )
            ).toBe("access");
            expect(
                await cipher.decrypt(
                    saved[0].refreshTokenEncrypted,
                    WALLET,
                    "refresh_token_encrypted"
                )
            ).toBe("refresh");
        });

        it("is single use", async () => {
            const { service, state } = await started();
            await service.handleCallback({ wallet: WALLET, code: "c1", state });
            await expect(
                service.handleCallback({ wallet: WALLET, code: "c1", state })
            ).rejects.toMatchObject({
                status: 400,
                code: "MONERIUM_AUTH_STATE_INVALID",
            });
        });

        it("refuses a state started by another wallet", async () => {
            const { service, state } = await started();
            await expect(
                service.handleCallback({ wallet: OTHER, code: "c1", state })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
        });

        it("refuses an unknown state", async () => {
            const { service } = setup();
            await expect(
                service.handleCallback({
                    wallet: WALLET,
                    code: "c",
                    state: "nope",
                })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
        });

        it("refuses an expired state", async () => {
            const { service, pending, state } = await started();
            const row = pending.get(state);
            if (row) row.expiresAt = new Date(Date.now() - 1000);
            await expect(
                service.handleCallback({ wallet: WALLET, code: "c", state })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
        });

        it("refuses a state that belongs to a SIWE handshake", async () => {
            const ctx = setup({
                connection: {
                    status: "reauth_required",
                    walletLinkState: "linked",
                    siweFailedAt: null,
                },
            });
            const { state } = await ctx.service.prepareSiwe({ wallet: WALLET });
            await expect(
                ctx.service.handleCallback({ wallet: WALLET, code: "c", state })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
        });

        it("maps a refused code to 422 and an upstream failure to 502", async () => {
            const refused = await started();
            refused.client.exchangeAuthorizationCode.mockRejectedValueOnce(
                new MoneriumApiError(400, "invalid_grant", "bad code")
            );
            await expect(
                refused.service.handleCallback({
                    wallet: WALLET,
                    code: "c",
                    state: refused.state,
                })
            ).rejects.toMatchObject({
                status: 422,
                code: "MONERIUM_TOKEN_EXCHANGE_FAILED",
            });

            const down = await started();
            down.client.exchangeAuthorizationCode.mockRejectedValueOnce(
                new MoneriumApiError(503, undefined, "down")
            );
            await expect(
                down.service.handleCallback({
                    wallet: WALLET,
                    code: "c",
                    state: down.state,
                })
            ).rejects.toMatchObject({
                status: 502,
                code: "MONERIUM_UPSTREAM_UNAVAILABLE",
            });
        });
    });

    describe("SIWE", () => {
        const eligible = {
            status: "reauth_required",
            walletLinkState: "linked",
            siweFailedAt: null,
        };

        it("prepares a message for an eligible wallet only", async () => {
            const { service } = setup({ connection: eligible });
            const { state, message } = await service.prepareSiwe({
                wallet: WALLET,
            });
            expect(state.length).toBeGreaterThan(10);
            expect(message).toContain("wallet.test wants you to sign in");
        });

        it.each([
            ["no connection", undefined],
            ["connected", { ...eligible, status: "connected" }],
            ["not linked", { ...eligible, walletLinkState: "none" }],
            ["failed before", { ...eligible, siweFailedAt: new Date() }],
            [
                "failed 6 days ago",
                {
                    ...eligible,
                    siweFailedAt: new Date(Date.now() - 6 * DAY_MS),
                },
            ],
        ])("refuses to prepare for %s", async (_name, connection) => {
            const { service } = setup({ connection });
            await expect(
                service.prepareSiwe({ wallet: WALLET })
            ).rejects.toMatchObject({
                status: 409,
                code: "MONERIUM_SIWE_UNAVAILABLE",
            });
        });

        it("offers SIWE again once a failure is older than 7 days", async () => {
            const { service } = setup({
                connection: {
                    ...eligible,
                    siweFailedAt: new Date(Date.now() - 8 * DAY_MS),
                },
            });
            await expect(
                service.prepareSiwe({ wallet: WALLET })
            ).resolves.toMatchObject({ state: expect.any(String) });
        });

        it("signs the EIP-55 checksummed address and lets the handshake live as long as the message", async () => {
            const { service, pending } = setup({ connection: eligible });
            const { message, state } = await service.prepareSiwe({
                wallet: WALLET,
            });
            expect(message).toContain(getAddress(WALLET));
            expect(message).not.toContain(WALLET);
            const ttl =
                (pending.get(state)?.expiresAt.getTime() ?? 0) - Date.now();
            expect(ttl).toBeGreaterThan(9 * 60_000);
            expect(ttl).toBeLessThanOrEqual(10 * 60_000);
        });

        it("refuses to prepare when SIWE is disabled", async () => {
            vi.stubEnv("MONERIUM_SIWE_ENABLED", "false");
            const { service } = setup({ connection: eligible });
            await expect(
                service.prepareSiwe({ wallet: WALLET })
            ).rejects.toMatchObject({
                code: "MONERIUM_SIWE_UNAVAILABLE",
            });
        });

        it("exchanges the code from the redirect and clears the failure flag", async () => {
            const { service, client, connections } = setup({
                connection: eligible,
            });
            const { state, message } = await service.prepareSiwe({
                wallet: WALLET,
            });
            client.submitSiwe.mockResolvedValue({
                kind: "code",
                code: "siwe-code",
            });

            const result = await service.submitSiwe({
                wallet: WALLET,
                state,
                signature: "0xabc",
            });

            expect(result).toEqual(STATUS);
            expect(client.submitSiwe.mock.calls[0][0]).toMatchObject({
                message,
                signature: "0xabc",
                state,
            });
            expect(connections.upsertConnected).toHaveBeenCalledWith(
                expect.objectContaining({ clearSiweFailure: true })
            );
        });

        it("records a rejection, logs Monerium's answer without the signature and answers 422", async () => {
            const { service, client, connections } = setup({
                connection: eligible,
            });
            const { state } = await service.prepareSiwe({ wallet: WALLET });
            client.submitSiwe.mockResolvedValue({
                kind: "rejected",
                error: "access_denied",
                description: "Address not linked",
            });

            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state,
                    signature: "0xsecret",
                })
            ).rejects.toMatchObject({
                status: 422,
                code: "MONERIUM_SIWE_REJECTED",
            });

            expect(connections.update).toHaveBeenCalledWith(WALLET, {
                siweFailedAt: expect.any(Date),
            });
            expect(connections.upsertConnected).not.toHaveBeenCalled();
            expect(log.warn).toHaveBeenCalledOnce();
            const logged = JSON.stringify(vi.mocked(log.warn).mock.calls[0]);
            expect(logged).toContain("access_denied");
            expect(logged).not.toContain("0xsecret");
        });

        it("records the failure when Monerium sends the wallet to the portal (not eligible)", async () => {
            const { service, client, connections } = setup({
                connection: eligible,
            });
            const { state } = await service.prepareSiwe({ wallet: WALLET });
            client.submitSiwe.mockResolvedValue({ kind: "not_eligible" });

            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state,
                    signature: "0xabc",
                })
            ).rejects.toMatchObject({ code: "MONERIUM_SIWE_REJECTED" });
            expect(connections.update).toHaveBeenCalledWith(WALLET, {
                siweFailedAt: expect.any(Date),
            });
        });

        it("answers 422 without recording a failure on an unexpected redirect", async () => {
            const { service, client, connections } = setup({
                connection: eligible,
            });
            const { state } = await service.prepareSiwe({ wallet: WALLET });
            client.submitSiwe.mockResolvedValue({
                kind: "unexpected",
                error: "state_mismatch",
            });

            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state,
                    signature: "0xabc",
                })
            ).rejects.toMatchObject({ code: "MONERIUM_SIWE_REJECTED" });
            expect(connections.update).not.toHaveBeenCalled();
        });

        it("rejects an expired SIWE state before calling Monerium and keeps the wallet eligible", async () => {
            const { service, client, connections, pending } = setup({
                connection: eligible,
            });
            const { state } = await service.prepareSiwe({ wallet: WALLET });
            const row = pending.get(state);
            if (row) row.expiresAt = new Date(Date.now() - 1000);

            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state,
                    signature: "0xabc",
                })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
            expect(client.submitSiwe).not.toHaveBeenCalled();
            expect(connections.update).not.toHaveBeenCalled();
        });

        it("does not record a failure when Monerium is down", async () => {
            const { service, client, connections } = setup({
                connection: eligible,
            });
            const { state } = await service.prepareSiwe({ wallet: WALLET });
            client.submitSiwe.mockRejectedValue(
                new MoneriumApiError(503, undefined, "down")
            );

            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state,
                    signature: "0xabc",
                })
            ).rejects.toMatchObject({ status: 502 });
            expect(connections.update).not.toHaveBeenCalled();
        });

        it("refuses an OAuth state on the SIWE endpoint", async () => {
            const { service } = setup({ connection: eligible });
            const { url } = await service.start({ wallet: WALLET });
            await expect(
                service.submitSiwe({
                    wallet: WALLET,
                    state: new URL(url).searchParams.get("state") ?? "",
                    signature: "0xabc",
                })
            ).rejects.toMatchObject({ code: "MONERIUM_AUTH_STATE_INVALID" });
        });
    });

    it("disconnect forgets the connection, pending auths and tracked orders of the wallet", async () => {
        const { service, connections, pendingAuths, trackedOrders } = setup();
        await service.disconnect(WALLET);
        expect(connections.deleteByWallet).toHaveBeenCalledWith(WALLET);
        expect(pendingAuths.deleteByWallet).toHaveBeenCalledWith(WALLET);
        expect(trackedOrders.deleteByWallet).toHaveBeenCalledWith(WALLET);
    });
});
