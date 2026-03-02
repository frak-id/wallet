import { describe, expect, it } from "vitest";
import {
    rowToSessionParams,
    type SessionInput,
    sessionToRow,
} from "./sessionAdapter";

/**
 * Tests for session adapter row<->session conversion logic.
 *
 * The actual adapter depends on Drizzle + Shopify Session class,
 * so we test the transformation logic independently.
 */

/* ------------------------------------------------------------------ */
/*  sessionToRow — mapping Session fields to DB row                    */
/* ------------------------------------------------------------------ */

describe("sessionToRow", () => {
    it("maps all fields correctly", () => {
        const session: SessionInput = {
            id: "session-123",
            shop: "test.myshopify.com",
            state: "active",
            isOnline: true,
            scope: "read_products",
            expires: new Date("2025-01-01"),
            accessToken: "shpat_xxx",
            onlineAccessInfo: { associated_user: { id: 42 } },
        };
        const row = sessionToRow(session);
        expect(row).toEqual({
            id: "session-123",
            shop: "test.myshopify.com",
            state: "active",
            isOnline: true,
            scope: "read_products",
            expires: new Date("2025-01-01"),
            accessToken: "shpat_xxx",
            userId: 42,
        });
    });

    it("handles offline session (no onlineAccessInfo)", () => {
        const session: SessionInput = {
            id: "offline_test.myshopify.com",
            shop: "test.myshopify.com",
            state: "active",
            isOnline: false,
        };
        const row = sessionToRow(session);
        expect(row.userId).toBeUndefined();
        expect(row.isOnline).toBe(false);
    });

    it("handles missing optional fields", () => {
        const session: SessionInput = {
            id: "s-1",
            shop: "shop.myshopify.com",
            state: "pending",
            isOnline: false,
        };
        const row = sessionToRow(session);
        expect(row.scope).toBeUndefined();
        expect(row.expires).toBeUndefined();
        expect(row.accessToken).toBeUndefined();
    });
});

/* ------------------------------------------------------------------ */
/*  rowToSession — mapping DB row back to Session params               */
/* ------------------------------------------------------------------ */

describe("rowToSessionParams", () => {
    it("maps all fields from row", () => {
        const row = {
            id: "session-123",
            shop: "test.myshopify.com",
            state: "active",
            isOnline: true,
            scope: "read_products,write_products",
            expires: new Date("2025-06-15T12:00:00Z"),
            accessToken: "shpat_abc",
            userId: 99,
        };
        const params = rowToSessionParams(row);
        expect(params.id).toBe("session-123");
        expect(params.shop).toBe("test.myshopify.com");
        expect(params.state).toBe("active");
        expect(params.isOnline).toBe(true);
        expect(params.scope).toBe("read_products,write_products");
        expect(params.expires).toBe(new Date("2025-06-15T12:00:00Z").getTime());
        expect(params.accessToken).toBe("shpat_abc");
        expect(params.onlineAccessInfo).toBe(99);
    });

    it("omits expires when null", () => {
        const row = {
            id: "s-1",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false as const,
            expires: null,
            scope: null,
            accessToken: null,
            userId: null,
        };
        const params = rowToSessionParams(row);
        expect(params).not.toHaveProperty("expires");
    });

    it("omits scope when null", () => {
        const row = {
            id: "s-1",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false as const,
            scope: null,
            expires: null,
            accessToken: null,
            userId: null,
        };
        const params = rowToSessionParams(row);
        expect(params).not.toHaveProperty("scope");
    });

    it("omits accessToken when null", () => {
        const row = {
            id: "s-1",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false as const,
            accessToken: null,
            scope: null,
            expires: null,
            userId: null,
        };
        const params = rowToSessionParams(row);
        expect(params).not.toHaveProperty("accessToken");
    });

    it("omits onlineAccessInfo when userId is null", () => {
        const row = {
            id: "s-1",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false as const,
            userId: null,
            scope: null,
            expires: null,
            accessToken: null,
        };
        const params = rowToSessionParams(row);
        expect(params).not.toHaveProperty("onlineAccessInfo");
    });
});

/* ------------------------------------------------------------------ */
/*  Round-trip consistency                                              */
/* ------------------------------------------------------------------ */

describe("round-trip session<->row", () => {
    it("preserves core fields through conversion cycle", () => {
        const original: SessionInput = {
            id: "session-rt",
            shop: "roundtrip.myshopify.com",
            state: "active",
            isOnline: true,
            scope: "read_products",
            accessToken: "shpat_rt",
        };
        const row = sessionToRow(original);
        const params = rowToSessionParams(
            row as {
                id: string;
                shop: string;
                state: string;
                isOnline: boolean;
                scope: string | null;
                expires: Date | null;
                accessToken: string | null;
                userId: number | null;
            }
        );

        expect(params.id).toBe(original.id);
        expect(params.shop).toBe(original.shop);
        expect(params.state).toBe(original.state);
        expect(params.isOnline).toBe(original.isOnline);
        expect(params.scope).toBe(original.scope);
        expect(params.accessToken).toBe(original.accessToken);
    });

    it("converts expires Date to timestamp through round-trip", () => {
        const expires = new Date("2025-12-31T23:59:59Z");
        const original: SessionInput = {
            id: "s-exp",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false,
            expires,
        };
        const row = sessionToRow(original);
        const params = rowToSessionParams(
            row as {
                id: string;
                shop: string;
                state: string;
                isOnline: boolean;
                scope: string | null;
                expires: Date | null;
                accessToken: string | null;
                userId: number | null;
            }
        );

        // Session stores expires as timestamp (number), row stores as Date
        expect(params.expires).toBe(expires.getTime());
    });
});
