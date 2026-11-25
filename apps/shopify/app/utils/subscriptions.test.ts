import type { ConnectSubscriptionResult } from "app/services.server/subscriptions";
import { describe, expect, it } from "vitest";
import {
    connectErrorKey,
    formatErrorDate,
    isTokenSubmittable,
} from "./subscriptions";

describe("isTokenSubmittable", () => {
    it("requires at least 8 characters after trimming", () => {
        expect(isTokenSubmittable("1234567")).toBe(false);
        expect(isTokenSubmittable("   1234567   ")).toBe(false);
        expect(isTokenSubmittable("12345678")).toBe(true);
    });

    it("rejects tokens over 512 characters", () => {
        expect(isTokenSubmittable("a".repeat(512))).toBe(true);
        expect(isTokenSubmittable("a".repeat(513))).toBe(false);
    });
});

describe("connectErrorKey", () => {
    it.each([
        ["connected", null],
        ["invalid_token", "subscriptions.errors.invalidToken"],
        ["webhook_missing", "subscriptions.errors.webhookMissing"],
        ["unavailable", "subscriptions.errors.unavailable"],
        ["failed", "subscriptions.errors.failed"],
    ] as const satisfies readonly (readonly [
        ConnectSubscriptionResult,
        string | null,
    ])[])("maps %s to %s", (result, key) => {
        expect(connectErrorKey(result)).toBe(key);
    });
});

describe("formatErrorDate", () => {
    it("formats in UTC regardless of the host time zone", () => {
        expect(formatErrorDate("2026-11-25T23:30:00Z", "en")).toBe(
            "Nov 25, 2026, 11:30 PM"
        );
    });

    it("returns null for an invalid date", () => {
        expect(formatErrorDate("not-a-date", "en")).toBeNull();
    });
});
