import { HttpResponseError, Session } from "@shopify/shopify-api";
import { describe, expect, it, vi } from "vitest";
import {
    migrateOfflineSessions,
    type NonExpiringOfflineSession,
} from "./expiringTokenMigration";

const expiringSession = (shop: string) =>
    new Session({
        id: `offline_${shop}`,
        shop,
        state: "",
        isOnline: false,
        accessToken: `shpat_new_${shop}`,
        expires: new Date("2027-01-01T01:00:00Z"),
        refreshToken: `shprt_${shop}`,
        refreshTokenExpires: new Date("2027-03-01T00:00:00Z"),
    });

const stored = (shop: string): NonExpiringOfflineSession => ({
    id: `offline_${shop}`,
    shop,
    accessToken: `shpat_${shop}`,
});

const shopifyError = (code: number, body: Record<string, unknown>) =>
    new HttpResponseError({
        message: "Received an error response from Shopify",
        code,
        statusText: code === 400 ? "Bad Request" : "Service Unavailable",
        body,
    });

const invalidSubjectToken = shopifyError(400, {
    error: "invalid_subject_token",
});

describe("migrateOfflineSessions", () => {
    it("stores the exchanged pair for every shop", async () => {
        const store = vi.fn().mockResolvedValue(true);

        const results = await migrateOfflineSessions(
            [stored("a.myshopify.com"), stored("b.myshopify.com")],
            {
                exchange: async ({ shop }) => expiringSession(shop),
                store,
            }
        );

        expect(results).toEqual([
            { shop: "a.myshopify.com", status: "migrated" },
            { shop: "b.myshopify.com", status: "migrated" },
        ]);
        expect(store.mock.calls.map(([s]) => s.refreshToken)).toEqual([
            "shprt_a.myshopify.com",
            "shprt_b.myshopify.com",
        ]);
    });

    it("tells a refused token, a transient failure and a lost store apart", async () => {
        const store = vi
            .fn()
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValue(true);

        const results = await migrateOfflineSessions(
            [
                stored("gone.myshopify.com"),
                stored("busy.myshopify.com"),
                stored("a.myshopify.com"),
                stored("b.myshopify.com"),
            ],
            {
                exchange: async ({ shop }) => {
                    if (shop === "gone.myshopify.com")
                        throw invalidSubjectToken;
                    if (shop === "busy.myshopify.com") {
                        throw shopifyError(503, {});
                    }
                    return expiringSession(shop);
                },
                store,
            }
        );

        expect(results).toEqual([
            {
                shop: "gone.myshopify.com",
                status: "dead",
                error: "400 invalid_subject_token",
            },
            {
                shop: "busy.myshopify.com",
                status: "failed",
                error: "503 Service Unavailable",
            },
            { shop: "a.myshopify.com", status: "unsaved", error: "db down" },
            { shop: "b.myshopify.com", status: "migrated" },
        ]);
    });

    it("clears only the shops whose token Shopify refuses", async () => {
        const clear = vi.fn().mockResolvedValue(undefined);

        const results = await migrateOfflineSessions(
            [stored("gone.myshopify.com"), stored("busy.myshopify.com")],
            {
                exchange: async ({ shop }) => {
                    throw shop === "gone.myshopify.com"
                        ? invalidSubjectToken
                        : new Error("socket hang up");
                },
                store: vi.fn(),
                clear,
            }
        );

        expect(results).toEqual([
            { shop: "gone.myshopify.com", status: "cleared" },
            {
                shop: "busy.myshopify.com",
                status: "failed",
                error: "socket hang up",
            },
        ]);
        expect(clear).toHaveBeenCalledExactlyOnceWith(
            stored("gone.myshopify.com")
        );
    });

    it("keeps a refused shop dead when clearing it fails", async () => {
        const results = await migrateOfflineSessions(
            [stored("gone.myshopify.com")],
            {
                exchange: async () => {
                    throw invalidSubjectToken;
                },
                store: vi.fn(),
                clear: vi.fn().mockRejectedValue(new Error("db down")),
            }
        );

        expect(results).toEqual([
            {
                shop: "gone.myshopify.com",
                status: "dead",
                error: "clear failed: db down",
            },
        ]);
    });
});
