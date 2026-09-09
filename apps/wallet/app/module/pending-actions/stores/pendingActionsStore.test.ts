import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import {
    PENDING_ACTIONS_STORE_NAME,
    pendingActionsStore,
} from "./pendingActionsStore";

beforeEach(() => {
    pendingActionsStore.getState().clearAll();
    localStorage.clear();
});

describe("pendingActionsStore — dedupe key", () => {
    test("prefers ticket-based dedupe when a ticket is present", () => {
        pendingActionsStore.getState().clearAll();

        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            ticket: "ticket-a",
        });
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            ticket: "ticket-b",
        });

        // Same merchantId + anonymousId, but different tickets: distinct
        // pending actions, not a dedupe collision.
        const actions = pendingActionsStore.getState().getValidActions();
        expect(actions).toHaveLength(2);

        pendingActionsStore.getState().clearAll();
    });

    test("falls back to anonymousId-keyed dedupe when no ticket is present (ROLLOUT-STEP-3)", () => {
        pendingActionsStore.getState().clearAll();

        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
        });
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            proof: "a-different-proof",
        });

        // Same merchantId + anonymousId, no ticket on either: the legacy key
        // still collapses these into one entry — the second add replaces
        // the first.
        const actions = pendingActionsStore.getState().getValidActions();
        expect(actions).toHaveLength(1);
        expect(
            actions[0]?.type === "ensure" ? actions[0].proof : undefined
        ).toBe("a-different-proof");

        pendingActionsStore.getState().clearAll();
    });

    test("navigation actions stay single-slot, unaffected by the ensure dedupe change", () => {
        pendingActionsStore.getState().clearAll();

        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
            search: { id: "1" },
        });
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
            search: { id: "2" },
        });

        const actions = pendingActionsStore.getState().getValidActions();
        expect(actions).toHaveLength(1);
        expect(
            actions[0]?.type === "navigation" ? actions[0].search : undefined
        ).toEqual({ id: "2" });

        pendingActionsStore.getState().clearAll();
    });
});

const validAction = {
    type: "ensure",
    merchantId: "merchant-1",
    anonymousId: "anon-1",
    id: "id-1",
    createdAt: 1_700_000_000_000,
    expiresAt: 4_000_000_000_000,
};

async function rehydrate(payload: unknown) {
    localStorage.setItem(PENDING_ACTIONS_STORE_NAME, JSON.stringify(payload));
    await pendingActionsStore.persist.rehydrate();
}

describe("pendingActionsStore — hydration guard", () => {
    describe.each([
        ["version 1", 1],
        ["version 0", 0],
        ["no version key", undefined],
    ])("with %s", (_, version) => {
        test("carries a well-formed payload across", async () => {
            await rehydrate({ state: { actions: [validAction] }, version });

            expect(pendingActionsStore.getState().actions).toEqual([
                validAction,
            ]);
        });

        test.each([
            ["a non-object payload", "not-an-object"],
            ["a non-array actions field", { actions: "nope" }],
            ["a missing actions field", {}],
        ])("degrades to empty on %s", async (_label, state) => {
            await rehydrate({ state, version });

            expect(pendingActionsStore.getState().actions).toEqual([]);
        });
    });

    test.each([
        ["a non-object element", "not-an-object"],
        ["an element with no expiresAt", { ...validAction, expiresAt: null }],
        ["an element with an unknown type", { ...validAction, type: "exec" }],
        ["an ensure with no merchantId", { ...validAction, merchantId: 42 }],
    ])("drops %s while keeping the valid one", async (_label, bad) => {
        await rehydrate({
            state: { actions: [bad, validAction] },
            version: 1,
        });

        expect(pendingActionsStore.getState().actions).toEqual([validAction]);
    });

    test.each([
        ["an absolute URL", "https://evil.example/steal"],
        ["a protocol-relative URL", "//evil.example/steal"],
        ["a javascript: scheme", "javascript:alert(1)"],
    ])("drops a navigation action pointing at %s", async (_label, to) => {
        await rehydrate({
            state: {
                actions: [
                    {
                        type: "navigation",
                        to,
                        id: "nav-1",
                        createdAt: 1_700_000_000_000,
                        expiresAt: 4_000_000_000_000,
                    },
                ],
            },
            version: 1,
        });

        expect(pendingActionsStore.getState().actions).toEqual([]);
    });

    test("keeps an in-app navigation target", async () => {
        const nav = {
            type: "navigation",
            to: "/pairing",
            search: { id: "abc" },
            id: "nav-2",
            createdAt: 1_700_000_000_000,
            expiresAt: 4_000_000_000_000,
        };

        await rehydrate({ state: { actions: [nav] }, version: 1 });

        expect(pendingActionsStore.getState().actions).toEqual([nav]);
    });

    test("drops unknown keys instead of overwriting actions", async () => {
        await rehydrate({
            state: { actions: [], clearAll: null, extra: "x" },
            version: 1,
        });

        expect(typeof pendingActionsStore.getState().clearAll).toBe("function");
        expect("extra" in pendingActionsStore.getState()).toBe(false);
    });

    test("getValidActions survives a hostile payload", async () => {
        await rehydrate({
            state: { actions: ["not-an-object", { nonsense: true }] },
            version: 1,
        });

        expect(pendingActionsStore.getState().getValidActions()).toEqual([]);
    });
});

describe("pendingActionsStore — expiry", () => {
    test("getValidActions drops an expired action and prunes it from the store", async () => {
        const expired = {
            ...validAction,
            id: "expired-1",
            expiresAt: Date.now() - 1000,
        };

        await rehydrate({
            state: { actions: [expired, validAction] },
            version: 1,
        });
        expect(pendingActionsStore.getState().actions).toHaveLength(2);

        expect(pendingActionsStore.getState().getValidActions()).toEqual([
            validAction,
        ]);
        // Pruned, not merely filtered on read.
        expect(pendingActionsStore.getState().actions).toEqual([validAction]);
    });

    test("an ensure action outlives a navigation action", () => {
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
        });
        pendingActionsStore.getState().addAction({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
        });

        const [nav, ensure] = pendingActionsStore.getState().actions;
        // Referral attribution must survive download + onboarding; a stale
        // deep link must not.
        expect(ensure?.expiresAt).toBeGreaterThan(nav?.expiresAt ?? 0);
    });
});
