import { afterEach, describe, expect, it, vi } from "vitest";
import {
    asFake,
    connectionRow,
    fakeTokens,
    stubMoneriumEnv,
    WALLET,
} from "../../../../test/mock/monerium";
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

const row = (overrides: Partial<MoneriumConnectionRow> = {}) =>
    connectionRow({
        profileId: "p",
        profileKind: "personal",
        profileState: "pending",
        ...overrides,
    });

describe("silentReconnect", () => {
    it.each([
        [
            "reauth + linked + no failure",
            "reauth_required",
            "linked",
            null,
            true,
        ],
        ["connected", "connected", "linked", null, false],
        ["reauth but not linked", "reauth_required", "none", null, false],
        ["reauth but link pending", "reauth_required", "pending", null, false],
        [
            "reauth, linked, SIWE failed before",
            "reauth_required",
            "linked",
            new Date(),
            false,
        ],
        [
            "reauth, linked, SIWE failed 8 days ago",
            "reauth_required",
            "linked",
            new Date(Date.now() - 8 * 24 * 60 * 60_000),
            true,
        ],
    ] as const)(
        "%s",
        (_name, status, walletLinkState, siweFailedAt, expected) => {
            expect(
                isSilentReconnectEligible({
                    status,
                    walletLinkState,
                    siweFailedAt,
                })
            ).toBe(expected);
        }
    );

    it("is exposed on the status response", () => {
        expect(
            toStatusResponse(
                row({ status: "reauth_required", walletLinkState: "linked" }),
                { environment: "production" }
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
        expect(toStatusResponse(undefined, { environment: "sandbox" })).toEqual(
            {
                connection: "none",
                profile: null,
                walletLink: "none",
                silentReconnect: false,
                environment: "sandbox",
            }
        );
    });

    it("includes the reason code only when present", () => {
        const config = { environment: "sandbox" } as const;
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
    stubMoneriumEnv();
    afterEach(() => {
        vi.useRealTimers();
    });

    function setup(initial: MoneriumConnectionRow | undefined) {
        let current = initial;
        const connections = {
            findByWallet: vi.fn(async () => current),
            updateIfProfileState: vi.fn(
                async (
                    _wallet: string,
                    expected: MoneriumConnectionRow["profileState"],
                    patch: Partial<MoneriumConnectionRow>
                ) => {
                    if (current?.profileState !== expected) return undefined;
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
        const service = new MoneriumStatusService(
            asFake<MoneriumConnectionRepository>(connections),
            asFake<MoneriumTokenService>(fakeTokens()),
            asFake<MoneriumApiClient>(client)
        );
        return {
            service,
            connections,
            client,
            moveTo(next: MoneriumConnectionRow) {
                current = next;
            },
        };
    }

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

    async function refreshPatch(
        initial: MoneriumConnectionRow,
        addresses: { address: string; chains: string[] }[] = []
    ) {
        const ctx = setup(initial);
        approvedContext(ctx.client);
        ctx.client.listAddresses.mockResolvedValue(addresses);
        const result = await ctx.service.refreshFromMonerium(WALLET);
        return {
            ...ctx,
            ...result,
            patch: ctx.connections.updateIfProfileState.mock.calls[0][2],
        };
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
        approvedContext(client);
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
        approvedContext(client);
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.walletLink).toBe("pending");
    });

    it("stamps when the link entered pending and keeps the stamp while it stays pending", async () => {
        const pendingAt = new Date(Date.now() - 3 * 60 * 60_000);
        const { after, patch } = await refreshPatch(
            row({
                walletLinkState: "pending",
                walletLinkPendingAt: pendingAt,
                profileState: "approved",
            })
        );

        expect(patch).not.toHaveProperty("walletLinkState");
        expect(patch).not.toHaveProperty("walletLinkPendingAt");
        expect(after).toMatchObject({
            walletLinkState: "pending",
            walletLinkPendingAt: pendingAt,
        });
    });

    it("gives up on a link that stayed pending for more than 24 hours", async () => {
        const { patch } = await refreshPatch(
            row({
                walletLinkState: "pending",
                walletLinkPendingAt: new Date(Date.now() - 25 * 60 * 60_000),
            })
        );

        expect(patch).toMatchObject({
            walletLinkState: "none",
            walletLinkPendingAt: null,
        });
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

        const patch = connections.updateIfProfileState.mock.calls[0][2];
        expect(patch).not.toHaveProperty("walletLinkState");
        expect(patch).not.toHaveProperty("walletLinkPendingAt");
        expect(connections.findByWallet).toHaveBeenCalledOnce();
    });

    it("answers 409 not connected when the row vanished before the refresh", async () => {
        const { service } = setup(undefined);
        await expect(service.refreshFromMonerium(WALLET)).rejects.toMatchObject(
            { status: 409, code: "MONERIUM_NOT_CONNECTED" }
        );
    });

    describe("recheck", () => {
        const isLinked = (candidate: MoneriumConnectionRow) =>
            candidate.walletLinkState === "linked";

        it("returns the row without calling Monerium when it already satisfies", async () => {
            const linked = row({ walletLinkState: "linked" });
            const { service, client } = setup(linked);
            await expect(
                service.recheck(WALLET, linked, isLinked)
            ).resolves.toBe(linked);
            expect(client.getAuthContext).not.toHaveBeenCalled();
        });

        it("refreshes once and returns the refreshed row, or null when it still does not satisfy", async () => {
            const linked = setup(row());
            approvedContext(linked.client);
            linked.client.listAddresses.mockResolvedValue([
                { address: WALLET, chains: ["arbitrumsepolia"] },
            ]);
            await expect(
                linked.service.recheck(WALLET, row(), isLinked)
            ).resolves.toMatchObject({ walletLinkState: "linked" });

            const unlinked = setup(row());
            approvedContext(unlinked.client);
            unlinked.client.listAddresses.mockResolvedValue([]);
            await expect(
                unlinked.service.recheck(WALLET, row(), isLinked)
            ).resolves.toBeNull();
            expect(unlinked.client.getAuthContext).toHaveBeenCalledOnce();
        });

        it("answers 502 when the refresh hits a Monerium failure", async () => {
            const { service, client } = setup(row());
            client.getAuthContext.mockRejectedValue(
                new MoneriumApiError(503, undefined, "down")
            );
            await expect(
                service.recheck(WALLET, row(), isLinked)
            ).rejects.toMatchObject({
                status: 502,
                code: "MONERIUM_UPSTREAM_UNAVAILABLE",
            });
        });
    });

    it("clears the pending stamp once the address is listed", async () => {
        const { patch } = await refreshPatch(
            row({
                walletLinkState: "pending",
                walletLinkPendingAt: new Date(),
            }),
            [{ address: WALLET, chains: ["arbitrumsepolia"] }]
        );

        expect(patch).toMatchObject({
            walletLinkState: "linked",
            walletLinkPendingAt: null,
        });
    });

    it("stamps the profile state change only when the state moved", async () => {
        const moved = await refreshPatch(row({ profileState: "pending" }));
        expect(moved.patch).toHaveProperty(
            "profileStateChangedAt",
            expect.any(Date)
        );

        const same = await refreshPatch(row({ profileState: "approved" }));
        expect(same.patch).not.toHaveProperty("profileStateChangedAt");
    });

    it.each([
        ["the state moved", "pending", undefined, true],
        ["the state is unchanged", "approved", undefined, false],
        ["another pod moved it first", "pending", "approved", false],
    ] as const)(
        "reports profileChanged when %s",
        async (_name, initial, concurrent, expected) => {
            const { service, client, moveTo } = setup(
                row({ profileState: initial })
            );
            approvedContext(client);
            client.listAddresses.mockImplementation(async () => {
                if (concurrent) moveTo(row({ profileState: concurrent }));
                return [];
            });

            const result = await service.refreshFromMonerium(WALLET);

            expect(result.profileChanged).toBe(expected);
            expect(result.before.profileState).toBe(initial);
            expect(result.after.profileState).toBe("approved");
        }
    );

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
