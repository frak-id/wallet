import { describe, expect, it, vi } from "vitest";
import {
    hasProviderNote,
    hasRenewalSignal,
    hasSellingPlan,
    pendingSubscription,
} from "./subscriptionSignals";

const line = (over: Record<string, unknown> = {}) =>
    ({
        product_id: 1,
        quantity: 1,
        price: "10.00",
        name: "Coffee",
        title: "Coffee",
        ...over,
    }) as never;

const order = (over: Record<string, unknown> = {}) =>
    ({
        line_items: [line()],
        note_attributes: [],
        source_name: "web",
        ...over,
    }) as never;

describe("subscription signals", () => {
    it("sees a selling plan on a line", () => {
        expect(hasSellingPlan(order())).toBe(false);
        expect(
            hasSellingPlan(
                order({ line_items: [line({ selling_plan_id: 42 })] })
            )
        ).toBe(true);
    });

    it("treats only a contract source as a renewal", () => {
        expect(hasRenewalSignal({ source_name: "subscription_contract" })).toBe(
            true
        );
        expect(hasRenewalSignal({ source_name: "web" })).toBe(false);
        expect(hasRenewalSignal({})).toBe(false);
    });

    it("reads a provider note as a hint, not a renewal", () => {
        const withNote = order({
            note_attributes: [{ name: "rc_subscription_ids", value: "1" }],
        });

        expect(hasProviderNote(withNote)).toBe(true);
        expect(hasRenewalSignal(withNote)).toBe(false);
    });
});

describe("pendingSubscription", () => {
    const pending = { state: "pending", attempts: 0, nextAttemptAt: null };

    it("leaves a merchant without a provider alone", async () => {
        const known = vi.fn();

        await expect(
            pendingSubscription({
                provider: null,
                order: order({ line_items: [line({ selling_plan_id: 1 })] }),
                renewalSignal: false,
                hasKnownSubscriber: known,
            })
        ).resolves.toBeUndefined();
        expect(known).not.toHaveBeenCalled();
    });

    it("marks an order sold through a selling plan", async () => {
        await expect(
            pendingSubscription({
                provider: "recharge",
                order: order({ line_items: [line({ selling_plan_id: 1 })] }),
                renewalSignal: false,
                hasKnownSubscriber: vi.fn(),
            })
        ).resolves.toEqual(pending);
    });

    it("marks an order from a known subscriber", async () => {
        await expect(
            pendingSubscription({
                provider: "recharge",
                order: order(),
                renewalSignal: false,
                hasKnownSubscriber: vi.fn().mockResolvedValue(true),
            })
        ).resolves.toEqual(pending);
    });

    it("leaves any other order untouched", async () => {
        await expect(
            pendingSubscription({
                provider: "recharge",
                order: order(),
                renewalSignal: false,
                hasKnownSubscriber: vi.fn().mockResolvedValue(false),
            })
        ).resolves.toBeUndefined();
    });
});
