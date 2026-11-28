import { describe, expect, it } from "vitest";
import type { PurchaseSubscription } from "../domain/purchases";
import { toInteractionSubscription } from "./subscriptionInteraction";

const resolved = (
    over: Partial<PurchaseSubscription>
): PurchaseSubscription => ({
    state: "resolved",
    attempts: 1,
    nextAttemptAt: null,
    kind: "checkout",
    providerSubscriptionIds: ["sub-1"],
    cyclesCovered: 1,
    merchandiseAmount: 30,
    ...over,
});

describe("toInteractionSubscription", () => {
    it("carries nothing for an order that is not a subscription", () => {
        expect(toInteractionSubscription(undefined)).toBeUndefined();
        expect(toInteractionSubscription(null)).toBeUndefined();
        expect(
            toInteractionSubscription(resolved({ kind: "none" }))
        ).toBeUndefined();
        expect(
            toInteractionSubscription(resolved({ state: "unresolved" }))
        ).toBeUndefined();
    });

    it("marks an unanswered order as pending", () => {
        expect(
            toInteractionSubscription({
                state: "pending",
                attempts: 0,
                nextAttemptAt: null,
            })
        ).toEqual({ state: "pending" });
    });

    it("counts a paid checkout as a cycle", () => {
        expect(toInteractionSubscription(resolved({}))).toEqual({
            state: "resolved",
            kind: "checkout",
            cyclesCovered: 1,
            merchandiseAmount: 30,
            counted: true,
            providerSubscriptionIds: ["sub-1"],
        });
    });

    it("does not count a cycle the merchant earned nothing on", () => {
        expect(
            toInteractionSubscription(
                resolved({ kind: "renewal", merchandiseAmount: 0 })
            )
        ).toMatchObject({ kind: "renewal", counted: false });
    });

    it("keeps the cycles a prepaid charge pays for", () => {
        expect(
            toInteractionSubscription(
                resolved({ cyclesCovered: 3, merchandiseAmount: 90 })
            )
        ).toMatchObject({ cyclesCovered: 3, counted: true });
    });

    it("turns a prepaid shipment into an uncounted renewal", () => {
        expect(
            toInteractionSubscription(
                resolved({ kind: "prepaid_shipment", cyclesCovered: 0 })
            )
        ).toMatchObject({
            kind: "renewal",
            cyclesCovered: 0,
            counted: false,
        });
    });
});
