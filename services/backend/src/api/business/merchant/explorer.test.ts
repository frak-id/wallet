import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

const updateExplorer = vi.fn();
const invalidateForMerchant = vi.fn();
const invalidateExplorerCache = vi.fn();

vi.mock("../../../domain/merchant", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../domain/merchant")>()),
    MerchantContext: {
        repositories: {
            merchant: {
                updateExplorer: (...args: unknown[]) => updateExplorer(...args),
            },
        },
        services: {
            resolve: {
                invalidateForMerchant: (...args: unknown[]) =>
                    invalidateForMerchant(...args),
            },
        },
    },
}));

vi.mock("../../../orchestration", () => ({
    OrchestrationContext: {
        orchestrators: {
            explorer: { invalidateCache: () => invalidateExplorerCache() },
        },
    },
}));

vi.mock("../middleware/session", () => ({
    businessSessionContext: new Elysia({ name: "test-session" }).macro({
        requireMerchantAccess: () => ({}),
    }),
}));

import { merchantExplorerRoutes } from "./explorer";

describe("PUT /:merchantId/explorer", () => {
    it("clears the merchant's resolve cache so the ambassador photo follows the Explorer image", async () => {
        const merchant = { id: MERCHANT_ID, domain: "example.com" };
        updateExplorer.mockResolvedValue(merchant);

        await merchantExplorerRoutes.handle(
            new Request(`http://localhost/${MERCHANT_ID}/explorer`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    config: { heroImageUrl: "https://cdn.example.com/a.jpg" },
                }),
            })
        );

        expect(invalidateExplorerCache).toHaveBeenCalled();
        expect(invalidateForMerchant).toHaveBeenCalledWith(merchant);
    });

    it("skips the resolve cache when the merchant was not updated", async () => {
        updateExplorer.mockResolvedValue(null);
        invalidateForMerchant.mockClear();

        await merchantExplorerRoutes.handle(
            new Request(`http://localhost/${MERCHANT_ID}/explorer`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled: true }),
            })
        );

        expect(invalidateForMerchant).not.toHaveBeenCalled();
    });
});
