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
        walletLinkPendingAt: null,
        profileStateChangedAt: null,
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
        markChecked: vi.fn(async () => undefined),
        markPlacementAccepted: vi.fn(async () => undefined),
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

    it("answers order null on an upstream 202 and remembers it was accepted", async () => {
        const { service, client, trackedOrders } = setup();
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });
        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toEqual({ orderId: ORDER_ID, order: null });
        expect(trackedOrders.markPlacementAccepted).toHaveBeenCalledWith(
            ORDER_ID
        );
    });

    it("rejects with 409 when the insert lost a race to another wallet's order id", async () => {
        const { service, client, trackedOrders } = setup();
        trackedOrders.insertIfAbsent.mockResolvedValue(false);
        trackedOrders.findById
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ id: ORDER_ID, wallet: OTHER_WALLET });

        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).rejects.toMatchObject({ status: 409 });
        expect(client.placeRedeemOrder).not.toHaveBeenCalled();
    });

    it("keeps going when the insert lost a race to the same wallet", async () => {
        const { service, client, trackedOrders } = setup();
        trackedOrders.insertIfAbsent.mockResolvedValue(false);
        trackedOrders.findById
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ id: ORDER_ID, wallet: WALLET });
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });

        await expect(
            service.placeOrder({ wallet: WALLET, body: body() })
        ).resolves.toMatchObject({ orderId: ORDER_ID });
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

    it("maps a Monerium 4xx to 422 with a fixed message and forgets the tracked row", async () => {
        const { service, client, trackedOrders } = setup();
        client.placeRedeemOrder.mockRejectedValue(
            new MoneriumApiError(400, "E_42", `Insufficient funds for ${IBAN}`)
        );

        const error = await service
            .placeOrder({ wallet: WALLET, body: body() })
            .catch((e) => e);
        expect(error).toMatchObject({
            status: 422,
            code: "MONERIUM_ORDER_REJECTED",
        });
        expect(error.message).not.toContain(IBAN);
        expect(error.message).not.toContain("Insufficient");
        expect(trackedOrders.deleteById).toHaveBeenCalledWith(ORDER_ID);
    });

    it.each([
        [401, "MONERIUM_REAUTH_REQUIRED"],
        [403, "MONERIUM_PROFILE_NOT_APPROVED"],
    ])(
        "answers 409 for an upstream %i that survived the token retry",
        async (status, code) => {
            const { service, client, trackedOrders } = setup();
            client.placeRedeemOrder.mockRejectedValue(
                new MoneriumApiError(status, undefined, "free text")
            );
            await expect(
                service.placeOrder({ wallet: WALLET, body: body() })
            ).rejects.toMatchObject({ status: 409, code });
            expect(trackedOrders.deleteById).toHaveBeenCalledWith(ORDER_ID);
        }
    );

    it("lets a corporate profile pay a third party above the personal document threshold", async () => {
        const amount = "20000";
        const thirdParty = {
            ...body(),
            amount,
            counterpart: {
                own: false as const,
                firstName: "Jane",
                lastName: "Doe",
                country: "DE",
            },
            message: buildRedeemOrderMessage({
                amount,
                iban: IBAN,
                at: new Date(Date.now() + 2 * 60_000),
            }),
        };
        const corporate = setup({
            connection: connection({ profileKind: "corporate" }),
        });
        corporate.client.placeRedeemOrder.mockResolvedValue({
            kind: "accepted",
        });
        await expect(
            corporate.service.placeOrder({ wallet: WALLET, body: thirdParty })
        ).resolves.toMatchObject({ orderId: ORDER_ID });

        const personal = setup();
        await expect(
            personal.service.placeOrder({ wallet: WALLET, body: thirdParty })
        ).rejects.toMatchObject({ code: "MONERIUM_AMOUNT_LIMIT" });
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
    const HOUR = 60 * 60_000;
    function tracked(overrides: Record<string, unknown> = {}) {
        return {
            id: ORDER_ID,
            wallet: WALLET,
            amount: "12.5",
            state: "placed" as const,
            placementAccepted: false,
            lastCheckedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides,
        };
    }

    it("returns the new state only to the caller that won the transition", async () => {
        const { service, client, trackedOrders } = setup();
        client.getOrder.mockResolvedValue(record("processed"));

        await expect(service.syncTrackedOrder(tracked())).resolves.toBe(
            "processed"
        );

        trackedOrders.transition.mockResolvedValueOnce(false);
        await expect(service.syncTrackedOrder(tracked())).resolves.toBeNull();
    });

    it("keeps an order Monerium does not know for the first hour", async () => {
        const { service, client, trackedOrders } = setup();
        client.getOrder.mockRejectedValue(
            new MoneriumApiError(404, undefined, "nope")
        );
        await service.syncTrackedOrder(
            tracked({ createdAt: new Date(Date.now() - 30 * 60_000) })
        );
        expect(trackedOrders.deleteById).not.toHaveBeenCalled();
        expect(trackedOrders.markChecked).toHaveBeenCalledWith(ORDER_ID);
    });

    it("forgets an order Monerium still does not know after an hour", async () => {
        const { service, client, trackedOrders } = setup();
        client.getOrder.mockRejectedValue(
            new MoneriumApiError(404, undefined, "nope")
        );
        await expect(
            service.syncTrackedOrder(
                tracked({ createdAt: new Date(Date.now() - 2 * HOUR) })
            )
        ).resolves.toBeNull();
        expect(trackedOrders.deleteById).toHaveBeenCalledWith(ORDER_ID);
    });

    it("waits a day for an order whose placement was accepted with a 202", async () => {
        const { service, client, trackedOrders } = setup();
        client.getOrder.mockRejectedValue(
            new MoneriumApiError(404, undefined, "nope")
        );
        await service.syncTrackedOrder(
            tracked({
                placementAccepted: true,
                createdAt: new Date(Date.now() - 5 * HOUR),
            })
        );
        expect(trackedOrders.deleteById).not.toHaveBeenCalled();

        await service.syncTrackedOrder(
            tracked({
                placementAccepted: true,
                createdAt: new Date(Date.now() - 25 * HOUR),
            })
        );
        expect(trackedOrders.deleteById).toHaveBeenCalledWith(ORDER_ID);
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

    it("shares one upstream list between orders and beneficiaries within a few seconds", async () => {
        const { service, client } = setup();
        client.listOrders.mockResolvedValue([record()]);

        await service.listOrders(WALLET);
        await service.listBeneficiaries(WALLET);
        await service.listOrders(WALLET);

        expect(client.listOrders).toHaveBeenCalledOnce();
    });

    it("lists again after the wallet placed an order", async () => {
        vi.stubEnv("MONERIUM_CLIENT_ID", "client-1");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.test");
        const { service, client } = setup();
        client.listOrders.mockResolvedValue([]);
        client.placeRedeemOrder.mockResolvedValue({ kind: "accepted" });

        await service.listOrders(WALLET);
        await service.placeOrder({ wallet: WALLET, body: body() });
        await service.listOrders(WALLET);

        expect(client.listOrders).toHaveBeenCalledTimes(2);
        vi.unstubAllEnvs();
    });

    it("does not keep a failed upstream list", async () => {
        const { service, client } = setup();
        client.listOrders
            .mockRejectedValueOnce(new MoneriumApiError(503, undefined, "down"))
            .mockResolvedValueOnce([]);

        await expect(service.listOrders(WALLET)).rejects.toMatchObject({
            status: 502,
        });
        await expect(service.listOrders(WALLET)).resolves.toEqual([]);
    });
});
