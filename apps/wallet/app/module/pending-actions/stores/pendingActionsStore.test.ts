import { describe, expect, test } from "@/tests/vitest-fixtures";
import { pendingActionsStore } from "./pendingActionsStore";

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

describe("pendingActionsStore — version/migrate", () => {
    test("migrate never throws and preserves actions from an unversioned payload", async () => {
        // A payload from before the `version`/`migrate` addition — zustand's
        // `persist` treats a missing `version` as 0 and always invokes `migrate`.
        const persistedState = {
            actions: [
                {
                    type: "ensure",
                    merchantId: "merchant-1",
                    anonymousId: "anon-1",
                    id: "id-1",
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 1000 * 60 * 60,
                },
                {
                    type: "navigation",
                    to: "/pairing",
                    search: { id: "abc" },
                    id: "id-2",
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 1000 * 60,
                },
            ],
        };

        const persistOptions = (
            pendingActionsStore as unknown as {
                persist: {
                    getOptions: () => {
                        migrate?: (
                            persistedState: unknown,
                            version: number
                        ) => unknown;
                    };
                };
            }
        ).persist.getOptions();

        expect(persistOptions.migrate).toBeDefined();
        expect(() => persistOptions.migrate?.(persistedState, 0)).not.toThrow();

        const migrated = persistOptions.migrate?.(persistedState, 0) as {
            actions: unknown[];
        };
        expect(migrated.actions).toHaveLength(2);
    });

    test("migrate degrades to an empty store on a malformed payload, rather than throwing", () => {
        const persistOptions = (
            pendingActionsStore as unknown as {
                persist: {
                    getOptions: () => {
                        migrate?: (
                            persistedState: unknown,
                            version: number
                        ) => unknown;
                    };
                };
            }
        ).persist.getOptions();

        expect(() => persistOptions.migrate?.(undefined, 0)).not.toThrow();
        expect(() => persistOptions.migrate?.({}, 0)).not.toThrow();
        expect(() =>
            persistOptions.migrate?.({ actions: "not-an-array" }, 0)
        ).not.toThrow();

        const migrated = persistOptions.migrate?.(
            { actions: "not-an-array" },
            0
        ) as { actions: unknown[] };
        expect(migrated.actions).toEqual([]);
    });
});
