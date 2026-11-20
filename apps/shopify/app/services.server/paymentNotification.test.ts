import { createHmac } from "node:crypto";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    fetchShopContact,
    notifyPaidPurchase,
    type PaidPurchaseNotification,
} from "./paymentNotification";

vi.mock("./logger", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    levelForStatus: () => "warn",
}));

const notification: PaidPurchaseNotification = {
    purchaseId: 42,
    shop: "acme.myshopify.com",
    domain: "acme.com",
    amount: "250",
    currency: "eur",
    bank: "0x3333333333333333333333333333333333333333",
    paidAt: "2026-11-20T10:00:00.000Z",
    test: false,
    shopName: "Acme",
    email: "owner@acme.com",
};

describe("notifyPaidPurchase", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        vi.stubEnv("SHOPIFY_API_SECRET", "app-secret");
        vi.stubEnv("BACKEND_URL", "https://backend.example");
        fetchMock.mockReset();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("posts the purchase signed over timestamp.body with the app secret", async () => {
        fetchMock.mockResolvedValue(new Response("ok"));

        await expect(notifyPaidPurchase(notification)).resolves.toBe(true);

        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe(
            "https://backend.example/ext/payments/shopify/purchase"
        );
        const headers = init?.headers as Record<string, string>;
        expect(init?.body).toBe(JSON.stringify(notification));
        expect(headers["x-frak-signature"]).toBe(
            createHmac("sha256", "app-secret")
                .update(`${headers["x-frak-timestamp"]}.${init?.body}`)
                .digest("hex")
        );
    });

    it("reports a backend rejection without throwing", async () => {
        fetchMock.mockResolvedValue(new Response("no", { status: 401 }));

        await expect(notifyPaidPurchase(notification)).resolves.toBe(false);
    });

    it("reports a network failure without throwing", async () => {
        fetchMock.mockRejectedValue(new Error("ECONNRESET"));

        await expect(notifyPaidPurchase(notification)).resolves.toBe(false);
    });

    it("sends nothing without the app secret", async () => {
        vi.stubEnv("SHOPIFY_API_SECRET", "");

        await expect(notifyPaidPurchase(notification)).resolves.toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("fetchShopContact", () => {
    it("reads the shop name and owner email", async () => {
        const admin = {
            graphql: vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            data: {
                                shop: { name: "Acme", email: "owner@acme.com" },
                            },
                        })
                    )
            ),
        } as unknown as AdminApiContext;

        await expect(fetchShopContact(admin)).resolves.toEqual({
            name: "Acme",
            email: "owner@acme.com",
        });
    });

    it("degrades to nulls without an offline session", async () => {
        await expect(fetchShopContact(undefined)).resolves.toEqual({
            name: null,
            email: null,
        });
    });
});
