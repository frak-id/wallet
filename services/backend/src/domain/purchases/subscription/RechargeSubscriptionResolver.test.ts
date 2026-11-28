import { describe, expect, it, vi } from "vitest";
import type {
    RechargeClient,
    RechargeOrder,
} from "../../../infrastructure/integrations/recharge";
import { RechargeSubscriptionResolver } from "./RechargeSubscriptionResolver";
import {
    SubscriptionAuthError,
    SubscriptionRateLimitError,
    SubscriptionUnavailableError,
} from "./types";

const TOKEN = "recharge-token";

const subscriptionLine = {
    purchase_item_id: 98765,
    purchase_item_type: "subscription",
};

const checkoutOrder: RechargeOrder = {
    id: 1234567,
    type: "CHECKOUT",
    is_prepaid: false,
    subtotal_price: "27.00",
    line_items: [subscriptionLine],
};

const renewalOrder: RechargeOrder = { ...checkoutOrder, type: "RECURRING" };

const prepaidCheckout: RechargeOrder = {
    ...checkoutOrder,
    is_prepaid: true,
    subtotal_price: "81.00",
};

const prepaidShipment: RechargeOrder = {
    ...renewalOrder,
    is_prepaid: true,
    subtotal_price: "0.00",
};

const threeMonthPrepaid = {
    id: 98765,
    order_interval_frequency: 1,
    charge_interval_frequency: 3,
};

function makeResolver(client: Partial<Record<keyof RechargeClient, unknown>>) {
    const resolver = new RechargeSubscriptionResolver({
        checkToken: vi.fn(),
        findOrderByExternalId: vi.fn(),
        getSubscription: vi.fn(),
        ...client,
    } as unknown as RechargeClient);
    return resolver;
}

const found = (order: RechargeOrder) => ({
    findOrderByExternalId: vi.fn().mockResolvedValue({
        kind: "found",
        value: order,
    }),
});

describe("RechargeSubscriptionResolver", () => {
    it("reads a monthly checkout as one cycle on the discounted subtotal", async () => {
        const resolver = makeResolver(found(checkoutOrder));

        await expect(
            resolver.resolve({ externalId: "5551234" }, TOKEN)
        ).resolves.toEqual({
            kind: "checkout",
            providerSubscriptionIds: ["98765"],
            cyclesCovered: 1,
            merchandiseAmount: 27,
        });
    });

    it("asks Recharge for the Shopify order id", async () => {
        const client = found(checkoutOrder);
        await makeResolver(client).resolve({ externalId: "5551234" }, TOKEN);

        expect(client.findOrderByExternalId).toHaveBeenCalledWith(
            "5551234",
            TOKEN
        );
    });

    it("reads a recurring order as a renewal", async () => {
        const resolver = makeResolver(found(renewalOrder));

        const result = await resolver.resolve({ externalId: "1" }, TOKEN);

        expect(result).toMatchObject({ kind: "renewal", cyclesCovered: 1 });
    });

    it("keeps a fully discounted renewal at 0 so it is not counted", async () => {
        const resolver = makeResolver(
            found({ ...renewalOrder, subtotal_price: "0.00" })
        );

        const result = await resolver.resolve({ externalId: "1" }, TOKEN);

        expect(result).toMatchObject({
            kind: "renewal",
            merchandiseAmount: 0,
        });
    });

    it("counts one cycle per interval a prepaid charge pays for", async () => {
        const resolver = makeResolver({
            ...found(prepaidCheckout),
            getSubscription: vi.fn().mockResolvedValue({
                kind: "found",
                value: threeMonthPrepaid,
            }),
        });

        const result = await resolver.resolve({ externalId: "1" }, TOKEN);

        expect(result).toMatchObject({
            kind: "checkout",
            cyclesCovered: 3,
            merchandiseAmount: 81,
        });
    });

    it("recognises the 0 prepaid shipments that follow a prepaid charge", async () => {
        const resolver = makeResolver(found(prepaidShipment));

        const result = await resolver.resolve({ externalId: "1" }, TOKEN);

        expect(result).toMatchObject({
            kind: "prepaid_shipment",
            cyclesCovered: 0,
        });
    });

    it("raises an unavailable error while a prepaid order's subscription cannot be read", async () => {
        const resolver = makeResolver({
            ...found(prepaidCheckout),
            getSubscription: vi.fn().mockResolvedValue({ kind: "unavailable" }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).rejects.toBeInstanceOf(SubscriptionUnavailableError);
    });

    it("answers none for an order without a subscription line", async () => {
        const resolver = makeResolver(
            found({
                ...checkoutOrder,
                line_items: [
                    { ...subscriptionLine, purchase_item_type: "onetime" },
                ],
            })
        );

        const result = await resolver.resolve({ externalId: "1" }, TOKEN);

        expect(result).toMatchObject({ kind: "none" });
    });

    it("retries when the order is missing", async () => {
        const resolver = makeResolver({
            findOrderByExternalId: vi
                .fn()
                .mockResolvedValue({ kind: "missing" }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).resolves.toBe("retry");
    });

    it("raises an unavailable error when the provider cannot be reached", async () => {
        const resolver = makeResolver({
            findOrderByExternalId: vi
                .fn()
                .mockResolvedValue({ kind: "unavailable" }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).rejects.toBeInstanceOf(SubscriptionUnavailableError);
    });

    it("raises an auth error when Recharge rejects the token", async () => {
        const resolver = makeResolver({
            findOrderByExternalId: vi
                .fn()
                .mockResolvedValue({ kind: "unauthorized" }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).rejects.toBeInstanceOf(SubscriptionAuthError);
    });

    it("raises a rate-limit error with Recharge's retry delay", async () => {
        const resolver = makeResolver({
            findOrderByExternalId: vi.fn().mockResolvedValue({
                kind: "rate_limited",
                retryAfterMs: 4000,
            }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).rejects.toMatchObject({
            name: "SubscriptionRateLimitError",
            retryAfterMs: 4000,
        });
    });

    it("raises a rate-limit error when the prepaid lookup is throttled", async () => {
        const resolver = makeResolver({
            ...found(prepaidCheckout),
            getSubscription: vi.fn().mockResolvedValue({
                kind: "rate_limited",
                retryAfterMs: 2000,
            }),
        });

        await expect(
            resolver.resolve({ externalId: "1" }, TOKEN)
        ).rejects.toBeInstanceOf(SubscriptionRateLimitError);
    });

    it("delegates the token check", async () => {
        const checkToken = vi.fn().mockResolvedValue("valid");

        await expect(
            makeResolver({ checkToken }).verifyToken(TOKEN)
        ).resolves.toBe("valid");
        expect(checkToken).toHaveBeenCalledWith(TOKEN);
    });
});
