import type { InferSelectModel } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { SessionTable } from "../schema/sessionTable";
import {
    rowToSessionParams,
    type SessionInput,
    sessionToRow,
} from "./sessionAdapter";

type SessionRow = InferSelectModel<SessionTable>;

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
    const nullRow: SessionRow = {
        id: "s-1",
        shop: "shop.myshopify.com",
        state: "active",
        isOnline: false,
        scope: null,
        expires: null,
        accessToken: null,
        refreshToken: null,
        refreshTokenExpires: null,
        userId: null,
    };

    it("maps all fields from row", () => {
        const params = rowToSessionParams({
            ...nullRow,
            id: "session-123",
            shop: "test.myshopify.com",
            isOnline: true,
            scope: "read_products,write_products",
            expires: new Date("2025-06-15T12:00:00Z"),
            accessToken: "shpat_abc",
            userId: 99,
        });
        expect(params.id).toBe("session-123");
        expect(params.shop).toBe("test.myshopify.com");
        expect(params.state).toBe("active");
        expect(params.isOnline).toBe(true);
        expect(params.scope).toBe("read_products,write_products");
        expect(params.expires).toBe(new Date("2025-06-15T12:00:00Z").getTime());
        expect(params.accessToken).toBe("shpat_abc");
        expect(params.onlineAccessInfo).toBe(99);
    });

    it("omits every nullable field when null", () => {
        const params = rowToSessionParams(nullRow);
        expect(params).not.toHaveProperty("expires");
        expect(params).not.toHaveProperty("scope");
        expect(params).not.toHaveProperty("accessToken");
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
        const params = rowToSessionParams(row as SessionRow);

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
        const params = rowToSessionParams(row as SessionRow);

        // Session stores expires as timestamp (number), row stores as Date
        expect(params.expires).toBe(expires.getTime());
    });

    // An expiring offline token is unrefreshable if either field is dropped
    // here: `ensureOfflineTokenIsNotExpired` short-circuits on a falsy
    // `session.refreshToken` and the shop silently loses Admin API access.
    it("preserves the refresh token pair through conversion cycle", () => {
        const refreshTokenExpires = new Date("2026-03-01T00:00:00Z");
        const original: SessionInput = {
            id: "offline_shop.myshopify.com",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false,
            accessToken: "shpat_expiring",
            expires: new Date("2026-01-01T01:00:00Z"),
            refreshToken: "shprt_abc",
            refreshTokenExpires,
        };
        const params = rowToSessionParams(sessionToRow(original) as SessionRow);

        expect(params.refreshToken).toBe("shprt_abc");
        expect(params.refreshTokenExpires).toBe(refreshTokenExpires.getTime());
    });

    it("omits the refresh token pair for a non-expiring session", () => {
        const params = rowToSessionParams({
            id: "offline_legacy.myshopify.com",
            shop: "legacy.myshopify.com",
            state: "active",
            isOnline: false,
            scope: null,
            expires: null,
            accessToken: "shpat_legacy",
            refreshToken: null,
            refreshTokenExpires: null,
            userId: null,
        });

        expect(params).not.toHaveProperty("refreshToken");
        expect(params).not.toHaveProperty("refreshTokenExpires");
    });
});
