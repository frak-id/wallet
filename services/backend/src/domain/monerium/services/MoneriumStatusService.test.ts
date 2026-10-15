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
            profiles: [
                { id: "p1", kind: "corporate", state: "created" },
                { id: "p2", kind: "personal", state: "approved" },
            ],
        });
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
            profiles: [{ id: "p", kind: "personal", state: "approved" }],
        });
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.profile?.state).toBe("approved");
    });

    it("falls back to the first of /profiles when the context lists none", async () => {
        const { service, client } = setup(row());
        client.getAuthContext.mockResolvedValue({
            userId: "u",
            profiles: [],
        });
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
            profiles: [{ id: "p", kind: "personal", state: "approved" }],
        });
        client.listAddresses.mockResolvedValue([]);
        const status = await service.getStatus(WALLET, { refresh: true });
        expect(status.walletLink).toBe("pending");
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
