import { buildRedeemOrderMessage } from "@frak-labs/app-essentials/monerium";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MoneriumConnectionRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type { MoneriumConnectionRepository } from "../repositories/MoneriumConnectionRepository";
import type { MoneriumTrackedOrderRepository } from "../repositories/MoneriumTrackedOrderRepository";
import type { MoneriumPlaceOrderBody } from "../schemas";
import type {
    MoneriumApiClient,
    MoneriumOrderRecord,
} from "./MoneriumApiClient";
import { MoneriumOrderService } from "./MoneriumOrderService";
import type { MoneriumStatusService } from "./MoneriumStatusService";
import type { MoneriumTokenService } from "./MoneriumTokenService";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;
const OTHER_WALLET = "0x00000000000000000000000000000000000000bb" as const;
const ORDER_ID = "3f0b6f7c-8c6c-4f7a-9d0f-2f4f0f9d2a11";
const IBAN = "DE89370400440532013000";

function connection(
    overrides: Partial<MoneriumConnectionRow> = {}
): MoneriumConnectionRow {
    return {
        wallet: WALLET,
        moneriumUserId: "u",
        profileId: "p",
        profileKind: "personal",
        profileState: "approved",
        profileReasonCode: null,
        walletLinkState: "linked",
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

function record(
    state: MoneriumOrderRecord["state"] = "placed"
): MoneriumOrderRecord {
    return {
        id: ORDER_ID,
        kind: "redeem",
        address: WALLET,
        chain: "arbitrumsepolia",
        currency: "eur",
        amount: "12.5",
        counterpart: {
            identifier: { standard: "iban", iban: IBAN },
            details: { own: true },
        },
        state,
        meta: { placedAt: "2026-10-15T12:00:00Z" },
    };
}

function body(): MoneriumPlaceOrderBody {
    return {
        orderId: ORDER_ID,
        amount: "12.5",
        iban: IBAN,
        counterpart: { own: true },
        message: buildRedeemOrderMessage({
            amount: "12.5",
            iban: IBAN,
            at: new Date(Date.now() + 2 * 60_000),
        }),
        signature: "0xabcdef",
    };
}

function setup(
    options: {
        connection?: MoneriumConnectionRow | undefined;
        tracked?: { id: string; wallet: `0x${string}` } | undefined;
    } = {}
) {
    const connections = {
        findByWallet: vi.fn(async () =>
            "connection" in options ? options.connection : connection()
        ),
    };
    const trackedOrders = {
        findById: vi.fn(async () => options.tracked),
        insertIfAbsent: vi.fn(async () => true),
        deleteById: vi.fn(async () => undefined),
        transition: vi.fn(async () => true),
    };
    const client = {
        placeRedeemOrder: vi.fn(),
        getOrder: vi.fn(),
        listOrders: vi.fn(),
    };
    const tokens = {
        withAccessToken: vi.fn(
            async (_wallet: string, call: (token: string) => unknown) =>
                call("token")
        ),
    };
    const status = { refreshFromMonerium: vi.fn() };
    const service = new MoneriumOrderService(
        connections as unknown as MoneriumConnectionRepository,
        trackedOrders as unknown as MoneriumTrackedOrderRepository,
        tokens as unknown as MoneriumTokenService,
        client as unknown as MoneriumApiClient,
        status as unknown as MoneriumStatusService
    );
    return { service, connections, trackedOrders, client, status };
}

describe("MoneriumOrderService.placeOrder", () => {
    beforeEach(() => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("places the order, tracks it without IBAN or names, and returns the DTO", async () => {
        const { service, client, trackedOrders } = setup();
        client.placeRedeemOrder.mockResolvedValue({
            kind: "order",
            order: record(),
        });

        const result = await service.placeOrder({
            wallet: WALLET,
            body: body(),
        });

        expect(result.orderId).toBe(ORDER_ID);
        expect(result.order?.state).toBe("placed");
        expect(trackedOrders.insertIfAbsent).toHaveBeenCalledWith({
            id: ORDER_ID,
            wallet: WALLET,
            amount: "12.5",
            state: "placed",
        });
        expect(client.placeRedeemOrder.mock.calls[0][1]).toMatchObject({
            id: ORDER_ID,
            chain: "arbitrumsepolia",
            iban: IBAN,
            details: { own: true },
            memo: "Frak Wallet offramp",
        });
    });

    it("answers order null on an upstream 202", async () => {
        const { service, client } = setup();
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toEqual({ orderId: ORDER_ID, order: null });
    });

    it("returns the existing order on a retry with a known id for the same wallet", async () => {
        const { service, client, trackedOrders } = setup({
            tracked: { id: ORDER_ID, wallet: WALLET },
        });
        client.getOrder.mockResolvedValue(record("pending"));

        const result = await service.placeOrder({
            wallet: WALLET,
            body: { ...body(), message: "stale message that no longer parses" },
        });

        expect(result.order?.state).toBe("pending");
        expect(client.placeRedeemOrder).not.toHaveBeenCalled();
        expect(trackedOrders.insertIfAbsent).not.toHaveBeenCalled();
    });

    it("compares wallets case-insensitively on the idempotent path", async () => {
        const { service, client } = setup({
            tracked: {
                id: ORDER_ID,
                wallet: WALLET.toUpperCase().replace(
                    "0X",
                    "0x"
                ) as `0x${string}`,
            },
        });
        client.getOrder.mockResolvedValue(record());
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toMatchObject({ orderId: ORDER_ID });
    });

    it("rejects a known id that belongs to another wallet with 409", async () => {
        const { service, client } = setup({
            tracked: { id: ORDER_ID, wallet: OTHER_WALLET },
        });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({ status: 409 });
        expect(client.getOrder).not.toHaveBeenCalled();
    });

    it("places again when the tracked id is unknown to Monerium", async () => {
        const { service, client } = setup({
            tracked: { id: ORDER_ID, wallet: WALLET },
        });
        client.getOrder.mockRejectedValue(
            new MoneriumApiError(404, undefined, "not found")
        );
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });

        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toEqual({ orderId: ORDER_ID, order: null });
        expect(client.placeRedeemOrder).toHaveBeenCalledOnce();
    });

    it("requires a connection", async () => {
        const { service } = setup({ connection: undefined });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_NOT_CONNECTED",
        });
    });

    it("requires re-authentication when the connection expired", async () => {
        const { service } = setup({
            connection: connection({ status: "reauth_required" }),
        });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({ code: "MONERIUM_REAUTH_REQUIRED" });
    });

    it("requires a linked wallet, after one refresh attempt", async () => {
        const { service, status, client } = setup({
            connection: connection({ walletLinkState: "none" }),
        });
        status.refreshFromMonerium.mockResolvedValue({
            after: connection({ walletLinkState: "none" }),
        });

        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_WALLET_NOT_LINKED",
        });
        expect(status.refreshFromMonerium).toHaveBeenCalledOnce();
        expect(client.placeRedeemOrder).not.toHaveBeenCalled();
    });

    it("proceeds when the refresh shows the wallet got linked", async () => {
        const { service, status, client } = setup({
            connection: connection({ walletLinkState: "pending" }),
        });
        status.refreshFromMonerium.mockResolvedValue({ after: connection() });
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toMatchObject({ orderId: ORDER_ID });
    });

    it("maps a Monerium 4xx to 422 with Monerium's message and forgets the tracked row", async () => {
        const { service, client, trackedOrders } = setup();
        client.placeRedeemOrder.mockRejectedValue(
            new MoneriumApiError(400, undefined, "Insufficient funds")
        );

        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({
            status: 422,
            code: "MONERIUM_ORDER_REJECTED",
            message: "Insufficient funds",
        });
        expect(trackedOrders.deleteById).toHaveBeenCalledWith(ORDER_ID);
    });

    it.each([
        ["5xx", new MoneriumApiError(503, undefined, "down")],
        ["429", new MoneriumApiError(429, undefined, "slow down", 30)],
        ["timeout", new MoneriumApiError(0, undefined, "timeout")],
    ])(
        "maps a Monerium %s to 502 and keeps the tracked row",
        async (_name, failure) => {
            const { service, client, trackedOrders } = setup();
            client.placeRedeemOrder.mockRejectedValue(failure);

            await expect(
                service.placeOrder({ wallet: WALLET, body: body() })
            ).rejects.toMatchObject({
                status: 502,
                code: "MONERIUM_UPSTREAM_UNAVAILABLE",
            });
            expect(trackedOrders.deleteById).not.toHaveBeenCalled();
        }
    );

    it("returns the existing order when Monerium reports the id as a duplicate", async () => {
        const { service, client } = setup();
        client.placeRedeemOrder.mockRejectedValue(
            new MoneriumApiError(409, undefined, "Order already exists")
        );
        client.getOrder.mockResolvedValue(record("pending"));

        const result = await service.placeOrder({
            wallet: WALLET,
            body: body(),
        });
        expect(result.order?.state).toBe("pending");
    });

    it("validates before talking to Monerium", async () => {
        const { service, client } = setup();
        await expect(
            service.placeOrder({
                wallet: WALLET,
                body: { ...body(), amount: "0" },
            })
        ).rejects.toMatchObject({ code: "MONERIUM_INVALID_AMOUNT" });
        expect(client.placeRedeemOrder).not.toHaveBeenCalled();
    });
});

describe("MoneriumOrderService.syncTrackedOrder", () => {
    it("returns the new state only to the caller that won the transition", async () => {
        const { service, client, trackedOrders } = setup();
        client.getOrder.mockResolvedValue(record("processed"));

        const tracked = {
            id: ORDER_ID,
            wallet: WALLET,
            amount: "12.5",
            state: "placed" as const,
            lastCheckedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await expect(service.syncTrackedOrder(tracked)).resolves.toBe(
            "processed"
        );

        trackedOrders.transition.mockResolvedValueOnce(false);
        await expect(service.syncTrackedOrder(tracked)).resolves.toBeNull();
    });
});

describe("MoneriumOrderService.listOrders", () => {
    it("lists the session wallet's orders newest first", async () => {
        const { service, client } = setup();
        client.listOrders.mockResolvedValue([
            {
                ...record(),
                id: "old",
                meta: { placedAt: "2026-10-01T00:00:00Z" },
            },
            {
                ...record(),
                id: "new",
                meta: { placedAt: "2026-10-09T00:00:00Z" },
            },
        ]);
        const orders = await service.listOrders(WALLET);
        expect(orders.map((o) => o.id)).toEqual(["new", "old"]);
        expect(client.listOrders).toHaveBeenCalledWith("token", {
            address: WALLET,
        });
    });
});
