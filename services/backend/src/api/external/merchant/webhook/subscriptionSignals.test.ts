import { describe, expect, it, vi } from "vitest";
import {
    hasProviderRenewalSignal,
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

describe("hasProviderRenewalSignal", () => {
    it("treats only a contract source as a renewal", () => {
        expect(
            hasProviderRenewalSignal("recharge", {
                source_name: "subscription_contract",
            })
        ).toBe(true);
        expect(
            hasProviderRenewalSignal("recharge", { source_name: "web" })
        ).toBe(false);
        expect(hasProviderRenewalSignal("recharge", {})).toBe(false);
    });

    it("lets a contract source skip attribution only for a merchant with a provider", () => {
        const contract = { source_name: "subscription_contract" };

        expect(hasProviderRenewalSignal("recharge", contract)).toBe(true);
        expect(hasProviderRenewalSignal(null, contract)).toBe(false);
    });

    it("reads a provider note as a hint, not a renewal", () => {
        const withNote = order({
            note_attributes: [{ name: "rc_subscription_ids", value: "1" }],
        });

        expect(hasProviderRenewalSignal("recharge", withNote)).toBe(false);
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

    it("marks an order carrying a selling plan allocation", async () => {
        await expect(
            pendingSubscription({
                provider: "recharge",
                order: order({
                    line_items: [line({ selling_plan_allocation: {} })],
                }),
                renewalSignal: false,
                hasKnownSubscriber: vi.fn(),
            })
        ).resolves.toEqual(pending);
    });

    it("marks an order carrying a provider note", async () => {
        await expect(
            pendingSubscription({
                provider: "recharge",
                order: order({
                    note_attributes: [
                        { name: "rc_subscription_ids", value: "1" },
                    ],
                }),
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
