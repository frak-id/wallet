import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoneriumConnectionRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import { MoneriumLinkService } from "./MoneriumLinkService";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;

const moneriumEnv = vi.hoisted(() => ({
    environment: "sandbox" as "sandbox" | "production",
}));
vi.mock("../config", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../config")>();
    return {
        ...actual,
        requireMoneriumConfig: () => ({
            ...actual.requireMoneriumConfig(),
            environment: moneriumEnv.environment,
        }),
    };
});

function approvedRow(
    overrides: Partial<MoneriumConnectionRow> = {}
): MoneriumConnectionRow {
    return {
        wallet: WALLET,
        moneriumUserId: "u",
        profileId: "p",
        profileKind: "personal",
        profileState: "approved",
        profileReasonCode: null,
        walletLinkState: "none",
        walletLinkPendingAt: null,
        profileStateChangedAt: null,
        status: "connected",
        accessTokenEncrypted: "x",
        accessTokenExpiresAt: new Date(),
        refreshTokenEncrypted: "y",
        siweFailedAt: null,
        stateCheckedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function setup(row = approvedRow()) {
    const connections = {
        findByWallet: vi.fn(async () => row),
        update: vi.fn(async () => undefined),
    };
    const client = { linkAddress: vi.fn() };
    const tokens = {
        withAccessToken: vi.fn(
            async (_wallet: string, call: (token: string) => unknown) =>
                call("token")
        ),
    };
    const status = { refreshFromMonerium: vi.fn() };
    const service = new MoneriumLinkService(
        connections as unknown as MoneriumConnectionRepository,
        tokens as unknown as MoneriumTokenService,
        client as unknown as MoneriumApiClient,
        status as unknown as MoneriumStatusService
    );
    return { service, connections, client, status };
}

describe("MoneriumLinkService.linkWallet", () => {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        moneriumEnv.environment = "sandbox";
    });

    it("links a pending profile in sandbox, where identities are never reviewed", async () => {
        const { service, client, status } = setup(
            approvedRow({ profileState: "pending" })
        );
        client.linkAddress.mockResolvedValue("created");

        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).resolves.toEqual({ walletLink: "linked" });
        expect(status.refreshFromMonerium).not.toHaveBeenCalled();
    });

    it("refuses a pending profile in production, after one upstream re-check", async () => {
        moneriumEnv.environment = "production";
        const pending = approvedRow({ profileState: "pending" });
        const { service, client, status } = setup(pending);
        status.refreshFromMonerium.mockResolvedValue({ after: pending });

        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_PROFILE_NOT_APPROVED",
        });
        expect(status.refreshFromMonerium).toHaveBeenCalledOnce();
        expect(client.linkAddress).not.toHaveBeenCalled();
    });

    it("stamps when the link entered pending on a 202", async () => {
        const { service, client, connections } = setup();
        client.linkAddress.mockResolvedValue("accepted");

        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).resolves.toEqual({ walletLink: "pending" });
        expect(connections.update).toHaveBeenCalledWith(WALLET, {
            walletLinkState: "pending",
            walletLinkPendingAt: expect.any(Date),
        });
    });

    it("clears the pending stamp when the link is created right away", async () => {
        const { service, client, connections } = setup();
        client.linkAddress.mockResolvedValue("created");

        await service.linkWallet({ wallet: WALLET, signature: "0xabc" });

        expect(connections.update).toHaveBeenCalledWith(WALLET, {
            walletLinkState: "linked",
            walletLinkPendingAt: null,
        });
    });

    it.each([
        [401, "MONERIUM_REAUTH_REQUIRED"],
        [403, "MONERIUM_PROFILE_NOT_APPROVED"],
    ])("answers 409 for an upstream %i", async (status, code) => {
        const { service, client, connections } = setup();
        client.linkAddress.mockRejectedValue(
            new MoneriumApiError(status, undefined, "free text")
        );
        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).rejects.toMatchObject({ status: 409, code });
        expect(connections.update).not.toHaveBeenCalled();
    });

    it("never hands Monerium's message to the client", async () => {
        const { service, client } = setup();
        client.linkAddress.mockRejectedValue(
            new MoneriumApiError(
                400,
                "E_1",
                "Signature of jane@doe.test invalid"
            )
        );
        const error = await service
            .linkWallet({ wallet: WALLET, signature: "0xabc" })
            .catch((e) => e);
        expect(error).toMatchObject({
            status: 422,
            code: "MONERIUM_LINK_REJECTED",
        });
        expect(error.message).not.toContain("jane");
    });
});
