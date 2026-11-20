import { createHmac } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    SECRET,
    fetchMock,
    deleteWhere,
    updateSet,
    updateWhere,
    updateReturning,
    notifyPaidPurchase,
} = vi.hoisted(() => {
    // Stubbed before any import: the node adapter captures `fetch` when loaded.
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    return {
        SECRET: "webhook-test-secret",
        fetchMock,
        deleteWhere: vi.fn(),
        updateSet: vi.fn(),
        updateWhere: vi.fn(),
        updateReturning: vi.fn(),
        notifyPaidPurchase: vi.fn(),
    };
});

vi.mock("app/db.server", () => ({
    drizzleDb: {
        delete: () => ({ where: deleteWhere }),
        update: () => ({
            set: (values: unknown) => {
                updateSet(values);
                return {
                    where: (where: unknown) => {
                        updateWhere(where);
                        return { returning: updateReturning };
                    },
                };
            },
        }),
    },
}));

vi.mock("app/services.server/paymentNotification", () => ({
    fetchShopContact: vi.fn(async () => ({
        name: "Gone Shop",
        email: "owner@gone.example",
    })),
    notifyPaidPurchase,
}));

vi.mock("../shopify.server", async () => {
    await import("@shopify/shopify-app-react-router/server/adapters/node");
    const { ApiVersion, AppDistribution, LogSeverity, shopifyApp } =
        await import("@shopify/shopify-app-react-router/server");
    const { MemorySessionStorage } = await import(
        "@shopify/shopify-app-session-storage-memory"
    );
    const sessionStorage = new MemorySessionStorage();
    const app = shopifyApp({
        apiKey: "webhook-test-key",
        apiSecretKey: SECRET,
        apiVersion: ApiVersion.October26,
        appUrl: "https://app.example",
        sessionStorage,
        distribution: AppDistribution.AppStore,
        logger: { level: LogSeverity.Error },
        future: { expiringOfflineAccessTokens: true },
    });
    return { authenticate: app.authenticate, sessionStorage };
});

import { sessionStorage } from "../shopify.server";
import { action } from "./webhooks";

const SHOP = "gone.myshopify.com";
const OFFLINE_ID = `offline_${SHOP}`;

function webhookRequest(topic: string, payload: unknown) {
    const body = JSON.stringify(payload);
    return new Request("https://app.example/webhooks", {
        method: "POST",
        body,
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Hmac-Sha256": createHmac("sha256", SECRET)
                .update(body)
                .digest("base64"),
            "X-Shopify-Topic": topic,
            "X-Shopify-Shop-Domain": SHOP,
            "X-Shopify-API-Version": "2026-10",
            "X-Shopify-Webhook-Id": "webhook-1",
        },
    });
}

function uninstallRequest() {
    return webhookRequest("app/uninstalled", { id: 1 });
}

function purchaseUpdateRequest(status: string) {
    return webhookRequest("app_purchases_one_time/update", {
        app_purchase_one_time: {
            admin_graphql_api_id: "gid://shopify/AppPurchaseOneTime/42",
            name: "Frak bank - 250.00eur",
            status,
            admin_graphql_api_shop_id: "gid://shopify/Shop/7",
            created_at: "2026-11-20T09:00:00Z",
            updated_at: "2026-11-20T10:00:00Z",
        },
    });
}

function whereSql(where: SQL) {
    const { sql, params } = new PgDialect().sqlToQuery(where);
    return { sql, params };
}

function args(request: Request) {
    return { request, params: {}, context: {} } as Parameters<typeof action>[0];
}

function deletedWhere() {
    return deleteWhere.mock.calls.map(([where]) => {
        const { sql, params } = new PgDialect().sqlToQuery(where);
        return { sql, params };
    });
}

describe("webhooks action, APP_PURCHASES_ONE_TIME_UPDATE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("notifies the backend once the purchase turns active", async () => {
        updateReturning.mockResolvedValue([
            {
                purchaseId: 42,
                shop: "gone.example",
                amount: "250",
                currency: "eur",
                bank: "0x3333333333333333333333333333333333333333",
            },
        ]);

        const response = await action(args(purchaseUpdateRequest("ACTIVE")));

        expect(response.status).toBe(200);
        expect(updateSet).toHaveBeenCalledWith({
            status: "active",
            updatedAt: new Date("2026-11-20T10:00:00Z"),
        });
        expect(whereSql(updateWhere.mock.calls[0]?.[0])).toEqual({
            sql: '("purchase"."purchaseId" = $1 and "purchase"."status" <> $2)',
            params: [42, "active"],
        });
        expect(notifyPaidPurchase).toHaveBeenCalledWith({
            purchaseId: 42,
            shop: SHOP,
            domain: "gone.example",
            amount: "250",
            currency: "eur",
            bank: "0x3333333333333333333333333333333333333333",
            paidAt: "2026-11-20T10:00:00.000Z",
            test: true,
            shopName: "Gone Shop",
            email: "owner@gone.example",
        });
    });

    it("stays silent on a redelivery of an already active purchase", async () => {
        updateReturning.mockResolvedValue([]);

        const response = await action(args(purchaseUpdateRequest("ACTIVE")));

        expect(response.status).toBe(200);
        expect(notifyPaidPurchase).not.toHaveBeenCalled();
    });

    it("records a declined purchase without notifying", async () => {
        updateReturning.mockResolvedValue([{ purchaseId: 42 }]);

        const response = await action(args(purchaseUpdateRequest("DECLINED")));

        expect(response.status).toBe(200);
        expect(whereSql(updateWhere.mock.calls[0]?.[0])).toEqual({
            sql: '"purchase"."purchaseId" = $1',
            params: [42],
        });
        expect(notifyPaidPurchase).not.toHaveBeenCalled();
    });
});

describe("webhooks action, APP_UNINSTALLED", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await sessionStorage.deleteSession(OFFLINE_ID);
    });

    it("deletes the shop's sessions when Shopify already rejects the refresh token", async () => {
        await sessionStorage.storeSession(
            new Session({
                id: OFFLINE_ID,
                shop: SHOP,
                state: "",
                isOnline: false,
                accessToken: "shpat_expired",
                expires: new Date(Date.now() - 60_000),
                refreshToken: "shprt_revoked",
                refreshTokenExpires: new Date(Date.now() + 86_400_000),
            })
        );
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ error: "invalid_request" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            })
        );

        const response = await action(args(uninstallRequest()));

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            `https://${SHOP}/admin/oauth/access_token`,
            expect.anything()
        );
        expect(deletedWhere()).toEqual([
            { sql: '"session"."shop" = $1', params: [SHOP] },
        ]);
    });

    it("deletes on a redelivery that finds no session", async () => {
        const response = await action(args(uninstallRequest()));

        expect(response.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(deletedWhere()).toEqual([
            { sql: '"session"."shop" = $1', params: [SHOP] },
        ]);
    });
});
