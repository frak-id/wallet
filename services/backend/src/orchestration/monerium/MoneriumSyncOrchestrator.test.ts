import { log } from "@backend-infrastructure";
import { describe, expect, it, vi } from "vitest";
import {
    asFake,
    connectionRow,
    OTHER_WALLET,
    stubMoneriumEnv,
    WALLET,
} from "../../../test/mock/monerium";
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

stubMoneriumEnv();

const connection = (overrides: Partial<MoneriumConnectionRow> = {}) =>
    connectionRow({
        profileId: "p",
        profileKind: "personal",
        profileState: "pending",
        accessTokenExpiresAt: new Date(),
        stateCheckedAt: null,
        ...overrides,
    });

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
        deleteStale: vi.fn(async () => undefined),
    };
    const rateLimitPause = new MoneriumRateLimitPause();
    const status = { refreshFromMonerium: vi.fn() };
    const orders = { syncTrackedOrder: vi.fn() };
    const notifications = { sendNotification: vi.fn(async () => undefined) };
    const orchestrator = new MoneriumSyncOrchestrator(
        asFake<MoneriumConnectionRepository>(connections),
        asFake<MoneriumTrackedOrderRepository>(trackedOrders),
        asFake<MoneriumStatusService>(status),
        asFake<MoneriumOrderService>(orders),
        asFake<NotificationsService>(notifications),
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

    it("pushes once when an order is processed, with the amount and no IBAN, name or memo", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder()],
        });
        orders.syncTrackedOrder.mockResolvedValue("processed");

        await orchestrator.syncTick();

        expect(notifications.sendNotification).toHaveBeenCalledOnce();
        const { wallets, payload } = sentPayload(notifications);
        expect(wallets).toEqual([WALLET]);
        expect(payload.en.body).toContain("€12.50");
        expect(payload.fr.body).toMatch(/12,50\s€/);
        expect(payload.en.data.url).toBe(
            "https://wallet.test/wallet?open=monerium"
        );
        expect(JSON.stringify(payload)).not.toMatch(/DE89|iban|memo/i);
    });

    it("pushes a rejection and nothing for a state that did not move", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [
                trackedOrder(WALLET, "a"),
                trackedOrder(OTHER_WALLET, "b"),
            ],
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

    it("stays silent on the first observation of a profile", async () => {
        const { orchestrator, status, notifications } = setup({
            profiles: [connection({ profileState: null })],
        });
        status.refreshFromMonerium.mockResolvedValue({
            before: connection({ profileState: null }),
            after: connection({ profileState: "approved" }),
            profileChanged: true,
        });
        await orchestrator.syncTick();
        expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it("stays silent for pending profiles and for transitions another pod already applied", async () => {
        const { orchestrator, status, notifications } = setup({
            profiles: [connection(), connection({ wallet: OTHER_WALLET })],
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

    it("claims each phase only after the previous one ran, then cleans up", async () => {
        const row = connection({ walletLinkState: "pending" });
        const { orchestrator, connections, trackedOrders, orders, status } =
            setup({
                orders: [trackedOrder()],
                profiles: [row],
                links: [connection({ wallet: OTHER_WALLET })],
            });
        orders.syncTrackedOrder.mockResolvedValue(null);
        status.refreshFromMonerium.mockResolvedValue({
            before: row,
            after: row,
            profileChanged: false,
        });

        const summary = await orchestrator.syncTick();

        expect(summary).toEqual({
            orders: 1,
            profiles: 1,
            links: 1,
            stoppedOnRateLimit: false,
        });
        const [profileRefresh, linkRefresh] =
            status.refreshFromMonerium.mock.invocationCallOrder;
        const sequence = [
            trackedOrders.claimInFlightDue.mock.invocationCallOrder[0],
            orders.syncTrackedOrder.mock.invocationCallOrder[0],
            connections.claimDueForProfileSync.mock.invocationCallOrder[0],
            profileRefresh,
            connections.claimDueForLinkSync.mock.invocationCallOrder[0],
            linkRefresh,
            trackedOrders.deleteStale.mock.invocationCallOrder[0],
        ];
        expect(sequence.every(Number.isInteger)).toBe(true);
        expect(sequence).toEqual([...sequence].sort((a, b) => a - b));
        expect(status.refreshFromMonerium.mock.calls.map(([w]) => w)).toEqual([
            WALLET,
            OTHER_WALLET,
        ]);
    });

    it("deletes stale tracked orders once per tick and survives a cleanup failure", async () => {
        const now = new Date("2026-10-15T12:00:00Z");
        const { orchestrator, trackedOrders } = setup();
        trackedOrders.deleteStale.mockRejectedValueOnce(new Error("db down"));

        await expect(orchestrator.syncTick(now)).resolves.toMatchObject({
            orders: 0,
        });
        expect(trackedOrders.deleteStale).toHaveBeenCalledExactlyOnceWith(now);
    });

    it("keeps the state change when the push fails", async () => {
        const { orchestrator, orders, notifications } = setup({
            orders: [trackedOrder(), trackedOrder(OTHER_WALLET, "order-2")],
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
            orders: [
                trackedOrder(WALLET, "a"),
                trackedOrder(OTHER_WALLET, "b"),
            ],
        });
        orders.syncTrackedOrder
            .mockRejectedValueOnce(new MoneriumApiError(503, undefined, "down"))
            .mockResolvedValueOnce("processed");

        await orchestrator.syncTick();

        expect(orders.syncTrackedOrder).toHaveBeenCalledTimes(2);
        expect(notifications.sendNotification).toHaveBeenCalledOnce();
    });

    it("stops the tick on 429 before claiming the next phase, and skips the following ticks while paused", async () => {
        const { orchestrator, orders, connections, status, rateLimitPause } =
            setup({
                orders: [
                    trackedOrder(WALLET, "a"),
                    trackedOrder(OTHER_WALLET, "b"),
                ],
                profiles: [connection()],
            });
        orders.syncTrackedOrder.mockImplementation(async () => {
            rateLimitPause.pause(600);
            throw new MoneriumApiError(429, undefined, "slow");
        });

        const first = await orchestrator.syncTick();
        expect(first.stoppedOnRateLimit).toBe(true);
        expect(orders.syncTrackedOrder).toHaveBeenCalledOnce();
        expect(connections.claimDueForProfileSync).not.toHaveBeenCalled();
        expect(status.refreshFromMonerium).not.toHaveBeenCalled();

        orders.syncTrackedOrder.mockClear();
        await orchestrator.syncTick(new Date(Date.now() + 60_000));
        expect(orders.syncTrackedOrder).not.toHaveBeenCalled();
    });

    it("stops on a 429 even when the shared pause was not set", async () => {
        const { orchestrator, orders } = setup({
            orders: [
                trackedOrder(WALLET, "a"),
                trackedOrder(OTHER_WALLET, "b"),
            ],
        });
        orders.syncTrackedOrder.mockRejectedValue(
            new MoneriumApiError(429, undefined, "slow")
        );
        const summary = await orchestrator.syncTick();
        expect(summary.stoppedOnRateLimit).toBe(true);
        expect(orders.syncTrackedOrder).toHaveBeenCalledOnce();
    });

    it("stops mid-phase once a user-facing call hit the rate limit", async () => {
        const { orchestrator, orders, status, rateLimitPause } = setup({
            orders: [
                trackedOrder(WALLET, "a"),
                trackedOrder(OTHER_WALLET, "b"),
            ],
            profiles: [connection()],
        });
        orders.syncTrackedOrder.mockImplementationOnce(async () => {
            rateLimitPause.pause(120);
            return null;
        });
        const summary = await orchestrator.syncTick();
        expect(summary).toMatchObject({ orders: 1, stoppedOnRateLimit: true });
        expect(orders.syncTrackedOrder).toHaveBeenCalledOnce();
        expect(status.refreshFromMonerium).not.toHaveBeenCalled();
    });

    it("does not poll while a user-facing call already hit the rate limit", async () => {
        const { orchestrator, trackedOrders, rateLimitPause } = setup();
        rateLimitPause.pause(120);
        const summary = await orchestrator.syncTick();
        expect(summary.stoppedOnRateLimit).toBe(false);
        expect(trackedOrders.claimInFlightDue).not.toHaveBeenCalled();
    });

    it("skips the tick once, with a single warning, while the tables are missing", async () => {
        const { orchestrator, trackedOrders, connections } = setup();
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
        expect(connections.claimDueForProfileSync).not.toHaveBeenCalled();
        expect(trackedOrders.deleteStale).not.toHaveBeenCalled();
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
