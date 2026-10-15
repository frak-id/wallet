import { describe, expect, it } from "vitest";
import { isSupportedShopifyApiVersion } from "./shopifyWebhook";

describe("isSupportedShopifyApiVersion", () => {
    it.each(["2024-10", "2025-04", "2026-04", "2026-07"])(
        "accepts %s",
        (version) => {
            expect(isSupportedShopifyApiVersion(version)).toBe(true);
        }
    );

    it.each(["2024-07", "unstable", "", undefined])("rejects %s", (version) => {
        expect(isSupportedShopifyApiVersion(version)).toBe(false);
    });
});
