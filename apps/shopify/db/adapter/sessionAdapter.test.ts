import { Session } from "@shopify/shopify-api";
import type { InferSelectModel } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { SessionTable } from "../schema/sessionTable";
import {
    rowToSessionParams,
    type SessionInput,
    sessionToRow,
} from "./sessionAdapter";

type SessionRow = InferSelectModel<SessionTable>;

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

function toSelectRow(session: SessionInput): SessionRow {
    const row = sessionToRow(session);
    return {
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.isOnline ?? false,
        scope: row.scope ?? null,
        expires: row.expires ?? null,
        accessToken: row.accessToken ?? null,
        refreshToken: row.refreshToken ?? null,
        refreshTokenExpires: row.refreshTokenExpires ?? null,
        userId: row.userId ?? null,
    };
}

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
        expect(row.refreshToken).toBeUndefined();
        expect(row.refreshTokenExpires).toBeUndefined();
    });
});

describe("rowToSessionParams", () => {
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
        for (const key of [
            "expires",
            "scope",
            "accessToken",
            "refreshToken",
            "refreshTokenExpires",
            "onlineAccessInfo",
        ]) {
            expect(params).not.toHaveProperty(key);
        }
    });
});

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
        const params = rowToSessionParams(toSelectRow(original));

        expect(params.id).toBe(original.id);
        expect(params.shop).toBe(original.shop);
        expect(params.state).toBe(original.state);
        expect(params.isOnline).toBe(original.isOnline);
        expect(params.scope).toBe(original.scope);
        expect(params.accessToken).toBe(original.accessToken);
    });

    it("converts expires Date to timestamp through round-trip", () => {
        const expires = new Date("2025-12-31T23:59:59Z");
        const params = rowToSessionParams(
            toSelectRow({
                id: "s-exp",
                shop: "shop.myshopify.com",
                state: "active",
                isOnline: false,
                expires,
            })
        );

        expect(params.expires).toBe(expires.getTime());
    });

    it("keeps the refresh token of an expiring offline session", () => {
        const refreshTokenExpires = new Date("2027-03-01T00:00:00Z");
        const original = new Session({
            id: "offline_shop.myshopify.com",
            shop: "shop.myshopify.com",
            state: "active",
            isOnline: false,
            accessToken: "shpat_expiring",
            expires: new Date("2027-01-01T01:00:00Z"),
            refreshToken: "shprt_abc",
            refreshTokenExpires,
        });

        const loaded = Session.fromPropertyArray(
            Object.entries(rowToSessionParams(toSelectRow(original)))
        );

        expect(loaded.refreshToken).toBe("shprt_abc");
        expect(loaded.refreshTokenExpires).toEqual(refreshTokenExpires);
        expect(loaded.accessToken).toBe("shpat_expiring");
    });
});
