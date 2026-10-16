import { log } from "@backend-infrastructure";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoneriumConnectionRow } from "../../domain/monerium/db/schema";
import { MoneriumApiError } from "../../domain/monerium/errors";
import type { MoneriumConnectionRepository } from "../../domain/monerium/repositories/MoneriumConnectionRepository";
import type { MoneriumTrackedOrderRepository } from "../../domain/monerium/repositories/MoneriumTrackedOrderRepository";
import type { MoneriumOrderService } from "../../domain/monerium/services/MoneriumOrderService";
import { MoneriumRateLimitPause } from "../../domain/monerium/services/MoneriumRateLimitPause";
import type { MoneriumStatusService } from "../../domain/monerium/services/MoneriumStatusService";
import type { NotificationsService } from "../../domain/notifications/services/NotificationsService";
import {
    MONERIUM_SYNC,
    MoneriumSyncOrchestrator,
} from "./MoneriumSyncOrchestrator";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;
const WALLET_2 = "0x00000000000000000000000000000000000000bb" as const;

function connection(
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
        walletLinkPendingAt: null,
        profileStateChangedAt: null,
        status: "connected",
        accessTokenEncrypted: "x",
        accessTokenExpiresAt: new Date(),
        refreshTokenEncrypted: "y",
        siweFailedAt: null,
        stateCheckedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function trackedOrder(wallet: `0x${string}` = WALLET, id = "order-1") {
    return {
        id,
        wallet,
        amount: "12.5",
        state: "placed" as const,
        placementAccepted: false,
        lastCheckedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function setup(
    due: {
        orders?: ReturnType<typeof trackedOrder>[];
        profiles?: MoneriumConnectionRow[];
        links?: MoneriumConnectionRow[];
    } = {}
) {
    const connections = {
        claimDueForProfileSync: vi.fn(async () => due.profiles ?? []),
        claimDueForLinkSync: vi.fn(async () => due.links ?? []),
    };
    const trackedOrders = {
        claimInFlightDue: vi.fn(async () => due.orders ?? []),
    };
    const rateLimitPause = new MoneriumRateLimitPause();
    const status = { refreshFromMonerium: vi.fn() };
    const orders = { syncTrackedOrder: vi.fn() };
    const notifications = { sendNotification: vi.fn(async () => undefined) };
    const orchestrator = new MoneriumSyncOrchestrator(
        connections as unknown as MoneriumConnectionRepository,
        trackedOrders as unknown as MoneriumTrackedOrderRepository,
        status as unknown as MoneriumStatusService,
        orders as unknown as MoneriumOrderService,
        notifications as unknown as NotificationsService,
        rateLimitPause
    );
    return {
        orchestrator,
        rateLimitPause,
        connections,
        trackedOrders,
        status,
        orders,
        notifications,
    };
}

function sentPayload(
    notifications: { sendNotification: ReturnType<typeof vi.fn> },
    call = 0
) {
    return notifications.sendNotification.mock.calls[call][0] as {
        wallets: string[];
        payload: Record<
            "en" | "fr",
            { title: string; body: string; data: { url: string } }
        >;
    };
}

describe("MoneriumSyncOrchestrator", () => {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("MONERIUM_APP_NAME", "Frak Sandbox");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("claims work in one statement per kind, with the age tiers and the batch cap", async () => {
        const now = new Date("2026-10-15T12:00:00Z");
        const { orchestrator, connections, trackedOrders } = setup();

        await orchestrator.syncTick(now);

        expect(trackedOrders.claimInFlightDue).toHaveBeenCalledWith({
            now,
            tiers: MONERIUM_SYNC.ORDER_TIERS,
            limit: 50,
        });
        expect(connections.claimDueForProfileSync).toHaveBeenCalledWith({
            now,
            tiers: MONERIUM_SYNC.PROFILE_TIERS,
            limit: 50,
        });
        expect(connections.claimDueForLinkSync).toHaveBeenCalledWith({
            now,
            tiers: MONERIUM_SYNC.LINK_TIERS,
            limit: 50,
        });
    });

    it("bounds the profile poll at 30 days and the link poll at 24 hours, backing off with age", () => {
        const profile = MONERIUM_SYNC.PROFILE_TIERS;
        expect(profile.at(-1)?.maxAgeMs).toBe(30 * 24 * 60 * 60_000);
        expect(profile.map((tier) => tier.recheckMs)).toEqual([
            10 * 60_000,
            60 * 60_000,
            6 * 60 * 60_000,
        ]);
        const link = MONERIUM_SYNC.LINK_TIERS;
        expect(link.at(-1)?.maxAgeMs).toBe(24 * 60 * 60_000);
        expect(link.map((tier) => tier.recheckMs)).toEqual([
            2 * 60_000,
            15 * 60_000,
        ]);
    });

    it("pushes once when an order is processed, with the amount and no IBAN, name or memo", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder()],
        });
        orders.syncTrackedOrder.mockResolvedValue("processed");

        await orchestrator.syncTick();

        expect(notifications.sendNotification).toHaveBeenCalledOnce();
        const { wallets, payload } = sentPayload(notifications);
        expect(wallets).toEqual([WALLET]);
        expect(payload.en.body).toContain("€12.5");
        expect(payload.fr.body).toContain("12,5 €");
        expect(payload.en.data.url).toBe(
            "https://wallet.test/wallet?open=monerium"
        );
        expect(JSON.stringify(payload)).not.toMatch(/DE89|iban|memo/i);
    });

    it("pushes a rejection and nothing for a state that did not move", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder(WALLET, "a"), trackedOrder(WALLET_2, "b")],
        });
        orders.syncTrackedOrder
            .mockResolvedValueOnce("rejected")
            .mockResolvedValueOnce(null);

        await orchestrator.syncTick();

        expect(notifications.sendNotification).toHaveBeenCalledOnce();
        expect(sentPayload(notifications).payload.en.title).toBe(
            "Transfer rejected"
        );
    });

    it("does not notify for an intermediate pending state", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder()],
        });
        orders.syncTrackedOrder.mockResolvedValue("pending");
        await orchestrator.syncTick();
        expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it("announces an approved profile and invites linking when the wallet is not linked", async () => {
        const { orchestrator, status, notifications } = setup({
            profiles: [connection()],
        });
        status.refreshFromMonerium.mockResolvedValue({
            before: connection(),
            after: connection({
                profileState: "approved",
                walletLinkState: "none",
            }),
            profileChanged: true,
        });

        await orchestrator.syncTick();

        const { payload } = sentPayload(notifications);
        expect(payload.en.title).toBe("Bank account approved");
        expect(payload.en.body).toMatch(/link your wallet/i);
        expect(payload.fr.body).toMatch(/liez votre portefeuille/i);
    });

    it("does not ask to link a wallet that is already linked", async () => {
        const { orchestrator, status, notifications } = setup({
            profiles: [connection()],
        });
        status.refreshFromMonerium.mockResolvedValue({
            before: connection(),
            after: connection({
                profileState: "approved",
                walletLinkState: "linked",
            }),
            profileChanged: true,
        });
        await orchestrator.syncTick();
        expect(sentPayload(notifications).payload.en.body).not.toMatch(/link/i);
    });

    it.each(["rejected", "closed"] as const)(
        "announces a %s profile",
        async (profileState) => {
            const { orchestrator, status, notifications } = setup({
                profiles: [connection()],
            });
            status.refreshFromMonerium.mockResolvedValue({
                before: connection(),
                after: connection({ profileState }),
                profileChanged: true,
            });
            await orchestrator.syncTick();
            expect(sentPayload(notifications).payload.en.title).toBe(
                "Bank account verification failed"
            );
        }
    );

    it("stays silent for pending profiles and for transitions another pod already applied", async () => {
        const { orchestrator, status, notifications } = setup({
            profiles: [connection(), connection({ wallet: WALLET_2 })],
        });
        status.refreshFromMonerium
            .mockResolvedValueOnce({
                before: connection(),
                after: connection({ profileState: "review" }),
                profileChanged: true,
            })
            .mockResolvedValueOnce({
                before: connection(),
                after: connection({ profileState: "approved" }),
                profileChanged: false,
            });
        await orchestrator.syncTick();
        expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it("refreshes a connection once even when it is due for both profile and link", async () => {
        const row = connection({ walletLinkState: "pending" });
        const { orchestrator, status } = setup({
            profiles: [row],
            links: [row],
        });
        status.refreshFromMonerium.mockResolvedValue({
            before: row,
            after: row,
            profileChanged: false,
        });
        const summary = await orchestrator.syncTick();
        expect(status.refreshFromMonerium).toHaveBeenCalledOnce();
        expect(summary).toMatchObject({ profiles: 1, links: 0 });
    });

    it("keeps the state change when the push fails", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder(), trackedOrder(WALLET_2, "order-2")],
        });
        orders.syncTrackedOrder.mockResolvedValue("processed");
        notifications.sendNotification.mockRejectedValueOnce(
            new Error("fcm down")
        );

        const summary = await orchestrator.syncTick();

        expect(summary.orders).toBe(2);
        expect(orders.syncTrackedOrder).toHaveBeenCalledTimes(2);
        expect(notifications.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("carries on with the next item after one failed", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder(WALLET, "a"), trackedOrder(WALLET_2, "b")],
        });
        orders.syncTrackedOrder
            .mockRejectedValueOnce(new MoneriumApiError(503, undefined, "down"))
            .mockResolvedValueOnce("processed");

        await orchestrator.syncTick();

        expect(orders.syncTrackedOrder).toHaveBeenCalledTimes(2);
        expect(notifications.sendNotification).toHaveBeenCalledOnce();
    });

    it("stops the tick on 429 and pauses the following ticks until Retry-After", async () => {
        const { orchestrator, orders, status, rateLimitPause } = setup({
            orders: [trackedOrder(WALLET, "a"), trackedOrder(WALLET_2, "b")],
            profiles: [connection()],
        });
        orders.syncTrackedOrder.mockRejectedValue(
            new MoneriumApiError(429, undefined, "slow", 600)
        );

        const first = await orchestrator.syncTick();
        expect(first.stoppedOnRateLimit).toBe(true);
        expect(orders.syncTrackedOrder).toHaveBeenCalledOnce();
        expect(status.refreshFromMonerium).not.toHaveBeenCalled();

        expect(rateLimitPause.isPaused(Date.now() + 599_000)).toBe(true);
        orders.syncTrackedOrder.mockClear();
        await orchestrator.syncTick(new Date(Date.now() + 60_000));
        expect(orders.syncTrackedOrder).not.toHaveBeenCalled();
    });

    it("pauses for 60 s when Monerium sends no Retry-After", async () => {
        const { orchestrator, orders, rateLimitPause } = setup({
            orders: [trackedOrder()],
        });
        orders.syncTrackedOrder.mockRejectedValue(
            new MoneriumApiError(429, undefined, "slow")
        );
        await orchestrator.syncTick();
        expect(rateLimitPause.isPaused(Date.now() + 59_000)).toBe(true);
        expect(rateLimitPause.isPaused(Date.now() + 61_000)).toBe(false);
    });

    it("does not poll while a user-facing call already hit the rate limit", async () => {
        const { orchestrator, trackedOrders, rateLimitPause } = setup();
        rateLimitPause.pause(120);
        const summary = await orchestrator.syncTick();
        expect(summary.stoppedOnRateLimit).toBe(false);
        expect(trackedOrders.claimInFlightDue).not.toHaveBeenCalled();
    });

    it("skips the tick once, with a single warning, while the tables are missing", async () => {
        const { orchestrator, trackedOrders } = setup();
        const missing = Object.assign(new Error("relation does not exist"), {
            code: "42P01",
        });
        trackedOrders.claimInFlightDue
            .mockRejectedValueOnce(
                new Error("Failed query", { cause: missing })
            )
            .mockRejectedValueOnce(missing);

        await expect(orchestrator.syncTick()).resolves.toMatchObject({
            orders: 0,
        });
        await expect(orchestrator.syncTick()).resolves.toMatchObject({
            orders: 0,
        });
        expect(log.warn).toHaveBeenCalledTimes(1);
    });

    it("still surfaces other database failures", async () => {
        const { orchestrator, trackedOrders } = setup();
        trackedOrders.claimInFlightDue.mockRejectedValueOnce(
            new Error("connection reset")
        );
        await expect(orchestrator.syncTick()).rejects.toThrow(
            "connection reset"
        );
    });

    it("skips the tick when the Monerium config is missing", async () => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "");
        const { orchestrator, trackedOrders } = setup();
        await expect(orchestrator.syncTick()).resolves.toMatchObject({
            orders: 0,
        });
        expect(trackedOrders.claimInFlightDue).not.toHaveBeenCalled();
    });
});
