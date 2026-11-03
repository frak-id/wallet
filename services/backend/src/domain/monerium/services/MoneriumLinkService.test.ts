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
import { MoneriumLinkService } from "./MoneriumLinkService";
import { MoneriumStatusService } from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";

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

stubMoneriumEnv();

const approvedRow = (overrides: Partial<MoneriumConnectionRow> = {}) =>
    connectionRow({
        profileId: "p",
        profileKind: "personal",
        profileState: "approved",
        accessTokenExpiresAt: new Date(),
        ...overrides,
    });

function setup(row: MoneriumConnectionRow | null = approvedRow()) {
    const connections = {
        findByWallet: vi.fn(async () => row ?? undefined),
        update: vi.fn(async () => undefined),
    };
    const client = { linkAddress: vi.fn() };
    const tokens = fakeTokens();
    const status = {
        refreshFromMonerium: vi.fn(),
        recheck(...args: Parameters<MoneriumStatusService["recheck"]>) {
            return MoneriumStatusService.prototype.recheck.apply(
                asFake<MoneriumStatusService>(this),
                args
            );
        },
    };
    const service = new MoneriumLinkService(
        asFake<MoneriumConnectionRepository>(connections),
        asFake<MoneriumTokenService>(tokens),
        asFake<MoneriumApiClient>(client),
        asFake<MoneriumStatusService>(status)
    );
    return { service, connections, client, status };
}

describe("MoneriumLinkService.linkWallet", () => {
    afterEach(() => {
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

    it.each([
        ["accepted", "pending", expect.any(Date)],
        ["created", "linked", null],
    ] as const)(
        "stores a %s link as %s, stamping the pending time only for pending",
        async (outcome, walletLinkState, walletLinkPendingAt) => {
            const { service, client, connections } = setup();
            client.linkAddress.mockResolvedValue(outcome);

            await service.linkWallet({ wallet: WALLET, signature: "0xabc" });

            expect(connections.update).toHaveBeenCalledWith(WALLET, {
                walletLinkState,
                walletLinkPendingAt,
            });
        }
    );

    it("answers 409 not connected without a row", async () => {
        const { service, client } = setup(null);
        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_NOT_CONNECTED",
        });
        expect(client.linkAddress).not.toHaveBeenCalled();
    });

    it("answers 409 re-authentication needed for an expired connection", async () => {
        const { service } = setup(approvedRow({ status: "reauth_required" }));
        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).rejects.toMatchObject({ code: "MONERIUM_REAUTH_REQUIRED" });
    });

    it("re-checks upstream when the approved profile has no cached id", async () => {
        const { service, client, status } = setup(
            approvedRow({ profileId: null })
        );
        status.refreshFromMonerium.mockResolvedValue({ after: approvedRow() });
        client.linkAddress.mockResolvedValue("created");

        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).resolves.toEqual({ walletLink: "linked" });
        expect(status.refreshFromMonerium).toHaveBeenCalledOnce();
        expect(client.linkAddress).toHaveBeenCalledWith(
            "token",
            expect.objectContaining({ profile: "p" })
        );
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

    function alreadyLinked(walletLinkState: "linked" | "none") {
        const ctx = setup();
        ctx.client.linkAddress.mockRejectedValue(
            new MoneriumApiError(409, undefined, "Address already linked")
        );
        ctx.status.refreshFromMonerium.mockResolvedValue({
            after: approvedRow({ walletLinkState }),
        });
        return ctx;
    }

    it("accepts an already-linked answer once our own profile lists the wallet", async () => {
        const { service, status } = alreadyLinked("linked");
        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).resolves.toEqual({ walletLink: "linked" });
        expect(status.refreshFromMonerium).toHaveBeenCalledOnce();
    });

    it("refuses an already-linked answer our own profile does not confirm", async () => {
        const { service } = alreadyLinked("none");
        await expect(
            service.linkWallet({ wallet: WALLET, signature: "0xabc" })
        ).rejects.toMatchObject({
            status: 422,
            code: "MONERIUM_LINK_REJECTED",
        });
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
