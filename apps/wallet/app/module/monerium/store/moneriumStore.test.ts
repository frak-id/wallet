import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../../tests/vitest-fixtures";
import {
    isMoneriumConnected,
    MONERIUM_STORE_NAME,
    moneriumStore,
    PENDING_AUTH_TTL_MS,
} from "./moneriumStore";

beforeEach(() => {
    moneriumStore.getState().disconnect();
    localStorage.clear();
});

describe("moneriumStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", () => {
            const state = moneriumStore.getState();

            expect(state.accessToken).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiry).toBeNull();
            expect(state.pendingCodeVerifier).toBeNull();
            expect(state.pendingState).toBeNull();
            expect(state.hasSeenSetupSuccess).toBe(false);
        });
    });

    describe("setTokens", () => {
        test("should set all token fields and compute expiry correctly", () => {
            const expiresIn = 3600;
            const beforeTime = Date.now();

            moneriumStore
                .getState()
                .setTokens("access-token-123", "refresh-token-456", expiresIn);

            const state = moneriumStore.getState();
            const afterTime = Date.now();

            expect(state.accessToken).toBe("access-token-123");
            expect(state.refreshToken).toBe("refresh-token-456");

            const expectedExpiry = beforeTime + expiresIn * 1000;
            const actualExpiry = state.tokenExpiry;

            expect(actualExpiry).toBeDefined();
            expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry);
            expect(actualExpiry).toBeLessThanOrEqual(
                afterTime + expiresIn * 1000
            );
        });
    });

    describe("setPendingAuth / clearPendingAuth", () => {
        test("should set verifier, state, and createdAt together", () => {
            const beforeTime = Date.now();
            moneriumStore
                .getState()
                .setPendingAuth("verifier-abc", "state-xyz");

            const state = moneriumStore.getState();
            expect(state.pendingCodeVerifier).toBe("verifier-abc");
            expect(state.pendingState).toBe("state-xyz");
            expect(state.pendingAuthCreatedAt).toBeGreaterThanOrEqual(
                beforeTime
            );
        });

        test("should clear verifier, state, and createdAt together", () => {
            moneriumStore
                .getState()
                .setPendingAuth("verifier-abc", "state-xyz");
            moneriumStore.getState().clearPendingAuth();

            const state = moneriumStore.getState();
            expect(state.pendingCodeVerifier).toBeNull();
            expect(state.pendingState).toBeNull();
            expect(state.pendingAuthCreatedAt).toBeNull();
        });
    });

    describe("disconnect", () => {
        test("should clear all fields to null", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600);
            moneriumStore
                .getState()
                .setPendingAuth("code-verifier", "csrf-state");

            let state = moneriumStore.getState();
            expect(state.accessToken).not.toBeNull();
            expect(state.refreshToken).not.toBeNull();

            moneriumStore.getState().disconnect();

            state = moneriumStore.getState();
            expect(state.accessToken).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiry).toBeNull();
            expect(state.pendingCodeVerifier).toBeNull();
            expect(state.pendingState).toBeNull();
            expect(state.pendingAuthCreatedAt).toBeNull();
        });
    });

    describe("isMoneriumConnected", () => {
        test("should return true when accessToken is set", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600);

            expect(isMoneriumConnected(moneriumStore.getState())).toBe(true);
        });

        test("should return false when accessToken is null", () => {
            expect(isMoneriumConnected(moneriumStore.getState())).toBe(false);
        });

        test("should return false after disconnect", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600);
            moneriumStore.getState().disconnect();

            expect(isMoneriumConnected(moneriumStore.getState())).toBe(false);
        });
    });
});

const disconnected = {
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    pendingCodeVerifier: null,
    pendingState: null,
    pendingAuthCreatedAt: null,
    hasSeenSetupSuccess: false,
};

// Derived from `disconnected` so the persisted field list lives in one place.
function persistedSlice() {
    const state = moneriumStore.getState() as Record<string, unknown>;
    return Object.fromEntries(
        Object.keys(disconnected).map((key) => [key, state[key]])
    );
}

async function rehydrate(payload: unknown) {
    localStorage.setItem(MONERIUM_STORE_NAME, JSON.stringify(payload));
    await moneriumStore.persist.rehydrate();
}

const malformed = [
    ["undefined", undefined],
    ["a non-object payload", "not-an-object"],
    ["an object missing fields", { accessToken: "tok" }],
    ["a wrongly typed field", { ...disconnected, tokenExpiry: "soon" }],
    ["a numeric token", { ...disconnected, accessToken: 12345 }],
] as const;

describe("moneriumStore — hydration guard", () => {
    describe.each([
        ["version 1", 1],
        ["version 0", 0],
        ["no version key", undefined],
    ])("with %s", (_, version) => {
        test.each(malformed)(
            "degrades to disconnected on %s, without throwing",
            async (_, state) => {
                moneriumStore
                    .getState()
                    .setTokens("live", "live-refresh", 3600);

                await rehydrate({ state, version });

                expect(persistedSlice()).toEqual(disconnected);
            }
        );

        test.each([
            ["without a timestamp", undefined],
            ["with its own timestamp", 1_700_000_000_000],
        ])("carries a valid payload across %s", async (_, createdAt) => {
            const valid = {
                accessToken: "access-token",
                refreshToken: "refresh-token",
                tokenExpiry: 1234567890,
                pendingCodeVerifier: null,
                pendingState: null,
                pendingAuthCreatedAt: createdAt,
                hasSeenSetupSuccess: true,
            };

            await rehydrate({ state: valid, version });

            expect(persistedSlice()).toEqual({
                ...valid,
                pendingAuthCreatedAt: createdAt ?? null,
            });
        });
    });

    test("drops unknown keys instead of overwriting actions", async () => {
        await rehydrate({
            state: { ...disconnected, disconnect: null, extra: "x" },
            version: 1,
        });

        expect(persistedSlice()).toEqual(disconnected);
        expect(() => moneriumStore.getState().disconnect()).not.toThrow();
        expect("extra" in moneriumStore.getState()).toBe(false);
    });
});

describe("moneriumStore — rehydration TTL", () => {
    test("clears an expired pending pair but keeps tokens intact", async () => {
        await rehydrate({
            state: {
                ...disconnected,
                accessToken: "access-token",
                refreshToken: "refresh-token",
                tokenExpiry: Date.now() + 60_000,
                pendingCodeVerifier: "stale-verifier",
                pendingState: "stale-state",
                pendingAuthCreatedAt: Date.now() - (PENDING_AUTH_TTL_MS + 1000),
            },
            version: 1,
        });

        const state = moneriumStore.getState();
        expect(state.pendingCodeVerifier).toBeNull();
        expect(state.pendingState).toBeNull();
        expect(state.pendingAuthCreatedAt).toBeNull();
        expect(state.accessToken).toBe("access-token");
        expect(state.refreshToken).toBe("refresh-token");
    });

    test("clears a pending pair written before the timestamp existed", async () => {
        await rehydrate({
            state: {
                ...disconnected,
                pendingCodeVerifier: "legacy-verifier",
                pendingState: "legacy-state",
            },
            version: 0,
        });

        expect(moneriumStore.getState().pendingCodeVerifier).toBeNull();
    });

    test("clears a pending pair stamped in the future", async () => {
        await rehydrate({
            state: {
                ...disconnected,
                pendingCodeVerifier: "future-verifier",
                pendingState: "future-state",
                pendingAuthCreatedAt: Date.now() + 10 * PENDING_AUTH_TTL_MS,
            },
            version: 1,
        });

        expect(moneriumStore.getState().pendingCodeVerifier).toBeNull();
    });

    test("keeps a fresh pending pair intact", async () => {
        const freshCreatedAt = Date.now() - 1000;
        await rehydrate({
            state: {
                ...disconnected,
                pendingCodeVerifier: "fresh-verifier",
                pendingState: "fresh-state",
                pendingAuthCreatedAt: freshCreatedAt,
            },
            version: 1,
        });

        const state = moneriumStore.getState();
        expect(state.pendingCodeVerifier).toBe("fresh-verifier");
        expect(state.pendingState).toBe("fresh-state");
        expect(state.pendingAuthCreatedAt).toBe(freshCreatedAt);
    });
});

describe("moneriumStore — partialize", () => {
    test("persists exactly the listed fields", () => {
        moneriumStore
            .getState()
            .setTokens("access-token", "refresh-token", 3600);

        const raw = localStorage.getItem(MONERIUM_STORE_NAME);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw as string) as {
            state: Record<string, unknown>;
            version: number;
        };

        expect(parsed.version).toBe(1);
        expect(Object.keys(parsed.state).sort()).toEqual(
            Object.keys(disconnected).sort()
        );
    });
});
