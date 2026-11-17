import { Session } from "@shopify/shopify-api";
import { describe, expect, it, vi } from "vitest";
import { migrateOfflineSessions } from "./expiringTokenMigration";

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

describe("migrateOfflineSessions", () => {
    it("stores the exchanged pair for every shop", async () => {
        const store = vi.fn().mockResolvedValue(true);

        const results = await migrateOfflineSessions(
            [
                { shop: "a.myshopify.com", accessToken: "shpat_a" },
                { shop: "b.myshopify.com", accessToken: "shpat_b" },
            ],
            {
                exchange: async ({ shop }) => expiringSession(shop),
                store,
            }
        );

        expect(results).toEqual([
            { shop: "a.myshopify.com", ok: true },
            { shop: "b.myshopify.com", ok: true },
        ]);
        expect(store.mock.calls.map(([s]) => s.refreshToken)).toEqual([
            "shprt_a.myshopify.com",
            "shprt_b.myshopify.com",
        ]);
    });

    it("keeps going past a shop whose exchange or store fails", async () => {
        const store = vi
            .fn()
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValue(true);

        const results = await migrateOfflineSessions(
            [
                { shop: "gone.myshopify.com", accessToken: "shpat_gone" },
                { shop: "a.myshopify.com", accessToken: "shpat_a" },
                { shop: "b.myshopify.com", accessToken: "shpat_b" },
            ],
            {
                exchange: async ({ shop }) => {
                    if (shop === "gone.myshopify.com") {
                        throw new Error("invalid_subject_token");
                    }
                    return expiringSession(shop);
                },
                store,
            }
        );

        expect(results).toEqual([
            {
                shop: "gone.myshopify.com",
                ok: false,
                error: "invalid_subject_token",
            },
            { shop: "a.myshopify.com", ok: false, error: "db down" },
            { shop: "b.myshopify.com", ok: true },
        ]);
    });
});
