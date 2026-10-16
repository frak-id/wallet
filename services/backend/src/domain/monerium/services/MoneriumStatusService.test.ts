import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoneriumConnectionRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import {
    isSilentReconnectEligible,
    MoneriumStatusService,
    toStatusResponse,
} from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;

function row(
    overrides: Partial<MoneriumConnectionRow> = {}
): MoneriumConnectionRow {
    return {
        wallet: WALLET,
        moneriumUserId: "u",
        profileId: "p",
        profileKind: "personal",
        profileState: "pending",
        profileReasonCode: null,
        walletLinkState: "none",
        status: "connected",
        accessTokenEncrypted: "x",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenEncrypted: "y",
        walletLinkPendingAt: null,
        profileStateChangedAt: null,
        siweFailedAt: null,
        stateCheckedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe("silentReconnect", () => {
    const enabled = { siweEnabled: true };

    it.each([
        [
            "reauth + linked + no failure + enabled",
            "reauth_required",
            "linked",
            null,
            true,
            true,
        ],
        ["connected", "connected", "linked", null, true, false],
        ["reauth but not linked", "reauth_required", "none", null, true, false],
        [
            "reauth but link pending",
            "reauth_required",
            "pending",
            null,
            true,
            false,
        ],
        [
            "reauth, linked, SIWE failed before",
            "reauth_required",
            "linked",
            new Date(),
            true,
            false,
        ],
        [
            "reauth, linked, SIWE failed 8 days ago",
            "reauth_required",
            "linked",
            new Date(Date.now() - 8 * 24 * 60 * 60_000),
            true,
            true,
        ],
        [
            "reauth, linked, SIWE disabled",
            "reauth_required",
            "linked",
            null,
            false,
            false,
        ],
    ] as const)(
        "%s",
        (_name, status, walletLinkState, siweFailedAt, siweEnabled, expected) => {
            expect(
                isSilentReconnectEligible(
                    { status, walletLinkState, siweFailedAt },
                    { siweEnabled }
                )
            ).toBe(expected);
        }
    );

    it("is exposed on the status response", () => {
        expect(
            toStatusResponse(
                row({ status: "reauth_required", walletLinkState: "linked" }),
                { ...enabled, environment: "production" }
            )
        ).toMatchObject({
            connection: "reauth_required",
            walletLink: "linked",
            silentReconnect: true,
            environment: "production",
        });
    });
});

describe("toStatusResponse", () => {
    it("answers none without a connection", () => {
        expect(
            toStatusResponse(undefined, {
                siweEnabled: true,
                environment: "sandbox",
            })
        ).toEqual({
            connection: "none",
            profile: null,
            walletLink: "none",
            silentReconnect: false,
            environment: "sandbox",
        });
    });

    it("includes the reason code only when present", () => {
        const config = { siweEnabled: true, environment: "sandbox" } as const;
        expect(toStatusResponse(row(), config).profile).toEqual({
            id: "p",
            kind: "personal",
            state: "pending",
        });
        expect(
            toStatusResponse(
                row({
                    profileState: "closed",
                    profileReasonCode: "compliance",
                }),
                config
            ).profile
        ).toMatchObject({ reasonCode: "compliance" });
    });
});

describe("MoneriumStatusService", () => {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
        vi.stubEnv("MONERIUM_APP_NAME", "Frak Sandbox");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    function setup(initial: MoneriumConnectionRow | undefined) {
        let current = initial;
        const connections = {
            findByWallet: vi.fn(async () => current),
            updateIfProfileState: vi.fn(
                async (
                    _wallet: string,
                    _expected: unknown,
                    patch: Partial<MoneriumConnectionRow>
                ) => {
                    current = current && { ...current, ...patch };
                    return current;
                }
            ),
        };
        const client = {
            getAuthContext: vi.fn(),
            listProfiles: vi.fn(),
            listAddresses: vi.fn(),
        };
        const tokens = {
            withAccessToken: vi.fn(
                async (_w: string, call: (token: string) => unknown) =>
                    call("token")
            ),
        };
        const service = new MoneriumStatusService(
            connections as unknown as MoneriumConnectionRepository,
            tokens as unknown as MoneriumTokenService,
            client as unknown as MoneriumApiClient
        );
        return { service, connections, client };
    }

    it("serves a fresh cache without calling Monerium", async () => {
        const { service, client } = setup(row());
        const status = await service.getStatus(WALLET, { refresh: false });
        expect(status.profile?.state).toBe("pending");
        expect(client.getAuthContext).not.toHaveBeenCalled();
    });

    it("refreshes a stale cache, picking the default profile and a linked address", async () => {
        const { service, client } = setup(
            row({ stateCheckedAt: new Date(Date.now() - 120_000) })
        );
        client.getAuthContext.mockResolvedValue({
            userId: "u2",
            defaultProfile: "p2",
        });
        client.listProfiles.mockResolvedValue([
            { id: "p1", kind: "corporate", state: "created" },
            { id: "p2", kind: "personal", state: "approved" },
        ]);
        client.listAddresses.mockResolvedValue([
            {
                address: WALLET.toUpperCase().replace("0X", "0x"),
                chains: ["arbitrumsepolia"],
            },
        ]);

        const status = await service.getStatus(WALLET, { refresh: false });

        expect(status).toMatchObject({
            profile: { id: "p2", state: "approved" },
            walletLink: "linked",
        });
        expect(client.listAddresses).toHaveBeenCalledWith("token", {
            profile: "p2",
            chain: "arbitrumsepolia",
        });
    });

    it("forces a refresh with refresh=true even when the cache is fresh", async () => {
        const { service, client } = setup(row());
        client.getAuthContext.mockResolvedValue({
            userId: "u",
            defaultProfile: "p",
        });
        client.listProfiles.mockResolvedValue([
            { id: "p", kind: "personal", state: "approved" },
        ]);
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.profile?.state).toBe("approved");
    });

    it("takes the profile state from /profiles, since /auth/context profiles carry none", async () => {
        const { service, client } = setup(row({ profileState: null }));
        client.getAuthContext.mockResolvedValue({
            userId: "u",
            defaultProfile: "p",
            profiles: [{ id: "p", kind: "personal", name: "Jo", perms: [] }],
        });
        client.listProfiles.mockResolvedValue([
            { id: "p", kind: "personal", state: "pending" },
        ]);
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.profile).toMatchObject({ id: "p", state: "pending" });
    });

    it("falls back to the first of /profiles when the context names no default", async () => {
        const { service, client } = setup(row());
        client.getAuthContext.mockResolvedValue({ userId: "u" });
        client.listProfiles.mockResolvedValue([
            { id: "p9", kind: "personal", state: "incomplete" },
        ]);
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.profile?.id).toBe("p9");
    });

    it("keeps a pending link pending until Monerium lists the address", async () => {
        const { service, client } = setup(row({ walletLinkState: "pending" }));
        client.getAuthContext.mockResolvedValue({
            userId: "u",
            defaultProfile: "p",
        });
        client.listProfiles.mockResolvedValue([
            { id: "p", kind: "personal", state: "approved" },
        ]);
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.walletLink).toBe("pending");
    });

    function approvedContext(client: {
        getAuthContext: ReturnType<typeof vi.fn>;
        listProfiles: ReturnType<typeof vi.fn>;
    }) {
        client.getAuthContext.mockResolvedValue({
            userId: "u",
            defaultProfile: "p",
        });
        client.listProfiles.mockResolvedValue([
            { id: "p", kind: "personal", state: "approved" },
        ]);
    }

    it("stamps when the link entered pending and keeps the stamp while it stays pending", async () => {
        const pendingAt = new Date(Date.now() - 3 * 60 * 60_000);
        const { service, client, connections } = setup(
            row({
                walletLinkState: "pending",
                walletLinkPendingAt: pendingAt,
                profileState: "approved",
            })
        );
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);

        await service.refreshFromMonerium(WALLET);

        expect(connections.updateIfProfileState.mock.calls[0][2]).toMatchObject(
            { walletLinkState: "pending", walletLinkPendingAt: pendingAt }
        );
    });

    it("gives up on a link that stayed pending for more than 24 hours", async () => {
        const { service, client, connections } = setup(
            row({
                walletLinkState: "pending",
                walletLinkPendingAt: new Date(Date.now() - 25 * 60 * 60_000),
            })
        );
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);

        await service.refreshFromMonerium(WALLET);

        expect(connections.updateIfProfileState.mock.calls[0][2]).toMatchObject(
            { walletLinkState: "none", walletLinkPendingAt: null }
        );
    });

    it("does not downgrade a link written as pending while the refresh was in flight", async () => {
        const { service, client, connections } = setup(row());
        approvedContext(client);
        client.listAddresses.mockImplementation(async () => {
            connections.findByWallet.mockResolvedValue(
                row({
                    walletLinkState: "pending",
                    walletLinkPendingAt: new Date(),
                })
            );
            return [];
        });

        await service.refreshFromMonerium(WALLET);

        expect(connections.updateIfProfileState.mock.calls[0][2]).toMatchObject(
            { walletLinkState: "pending" }
        );
    });

    it("clears the pending stamp once the address is listed", async () => {
        const { service, client, connections } = setup(
            row({ walletLinkState: "pending", walletLinkPendingAt: new Date() })
        );
        approvedContext(client);
        client.listAddresses.mockResolvedValue([
            { address: WALLET, chains: ["arbitrumsepolia"] },
        ]);

        await service.refreshFromMonerium(WALLET);

        expect(connections.updateIfProfileState.mock.calls[0][2]).toMatchObject(
            { walletLinkState: "linked", walletLinkPendingAt: null }
        );
    });

    it("stamps the profile state change only when the state moved", async () => {
        const { service, client, connections } = setup(
            row({ profileState: "pending" })
        );
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);
        await service.refreshFromMonerium(WALLET);
        expect(
            connections.updateIfProfileState.mock.calls[0][2]
        ).toHaveProperty("profileStateChangedAt", expect.any(Date));

        const same = setup(row({ profileState: "approved" }));
        approvedContext(same.client);
        same.client.listAddresses.mockResolvedValue([]);
        await same.service.refreshFromMonerium(WALLET);
        expect(
            same.connections.updateIfProfileState.mock.calls[0][2]
        ).not.toHaveProperty("profileStateChangedAt");
    });

    it("lets a wallet force at most one upstream refresh per 5 seconds", async () => {
        const { service, client } = setup(row());
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);

        await service.getStatus(WALLET, { refresh: true });
        await service.getStatus(WALLET, { refresh: true });
        expect(client.getAuthContext).toHaveBeenCalledOnce();

        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 6_000);
        await service.getStatus(WALLET, { refresh: true });
        vi.useRealTimers();
        expect(client.getAuthContext).toHaveBeenCalledTimes(2);
    });

    it("forces again right away after a failed forced refresh", async () => {
        const { service, client } = setup(row());
        client.getAuthContext.mockRejectedValueOnce(
            new MoneriumApiError(503, undefined, "down")
        );
        await service.getStatus(WALLET, { refresh: true });
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);
        await service.getStatus(WALLET, { refresh: true });
        expect(client.getAuthContext).toHaveBeenCalledTimes(2);
    });

    it("returns the cache when Monerium fails", async () => {
        const { service, client } = setup(row());
        client.getAuthContext.mockRejectedValue(
            new MoneriumApiError(503, undefined, "down")
        );
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.profile?.state).toBe("pending");
        expect(status.connection).toBe("connected");
    });

    it("does not call Monerium for a connection that needs re-authentication", async () => {
        const { service, client } = setup(
            row({ status: "reauth_required", walletLinkState: "linked" })
        );
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status).toMatchObject({
            connection: "reauth_required",
            silentReconnect: true,
        });
        expect(client.getAuthContext).not.toHaveBeenCalled();
    });

    it("answers 502 when the client id is missing", async () => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "");
        const { service } = setup(row());
        await expect(
            service.getStatus(WALLET, { refresh: false })
        ).rejects.toMatchObject({
            status: 502,
            code: "MONERIUM_UPSTREAM_UNAVAILABLE",
        });
    });
});
