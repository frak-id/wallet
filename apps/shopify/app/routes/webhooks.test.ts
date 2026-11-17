import { createHmac } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { SECRET, fetchMock, deleteWhere } = vi.hoisted(() => {
    // Stubbed before any import: the node adapter captures `fetch` when loaded.
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    return { SECRET: "webhook-test-secret", fetchMock, deleteWhere: vi.fn() };
});

vi.mock("app/db.server", () => ({
    drizzleDb: { delete: () => ({ where: deleteWhere }) },
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

function uninstallRequest() {
    const body = JSON.stringify({ id: 1 });
    return new Request("https://app.example/webhooks", {
        method: "POST",
        body,
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Hmac-Sha256": createHmac("sha256", SECRET)
                .update(body)
                .digest("base64"),
            "X-Shopify-Topic": "app/uninstalled",
            "X-Shopify-Shop-Domain": SHOP,
            "X-Shopify-API-Version": "2026-10",
            "X-Shopify-Webhook-Id": "webhook-1",
        },
    });
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
