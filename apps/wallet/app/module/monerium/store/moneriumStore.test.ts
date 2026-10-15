import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../../tests/vitest-fixtures";
import { MONERIUM_STORE_NAME, moneriumStore } from "./moneriumStore";

beforeEach(() => {
    moneriumStore.getState().reset();
    localStorage.clear();
});

async function rehydrate(payload: unknown) {
    localStorage.setItem(MONERIUM_STORE_NAME, JSON.stringify(payload));
    await moneriumStore.persist.rehydrate();
}

function stored() {
    return JSON.parse(localStorage.getItem(MONERIUM_STORE_NAME) as string) as {
        state: Record<string, unknown>;
        version: number;
    };
}

describe("moneriumStore", () => {
    test("starts without having seen the setup success", () => {
        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(false);
    });

    test("markSetupSuccessSeen persists and reset clears it", () => {
        moneriumStore.getState().markSetupSuccessSeen();
        expect(stored().state).toEqual({ hasSeenSetupSuccess: true });

        moneriumStore.getState().reset();
        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(false);
    });

    test("persists only the UI flag at version 2", () => {
        moneriumStore.getState().markSetupSuccessSeen();
        expect(stored().version).toBe(2);
        expect(Object.keys(stored().state)).toEqual(["hasSeenSetupSuccess"]);
    });
});

describe("moneriumStore — v1 token purge", () => {
    const v1 = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiry: 1234567890,
        pendingCodeVerifier: "verifier",
        pendingState: "state",
        pendingAuthCreatedAt: 1_700_000_000_000,
        hasSeenSetupSuccess: true,
    };

    test("keeps the UI flag and drops every token and PKCE field", async () => {
        await rehydrate({ state: v1, version: 1 });

        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(true);
        const raw = localStorage.getItem(MONERIUM_STORE_NAME) as string;
        expect(raw).not.toContain("access-token");
        expect(raw).not.toContain("refresh-token");
        expect(raw).not.toContain("verifier");
        expect(stored()).toEqual({
            state: { hasSeenSetupSuccess: true },
            version: 2,
        });
    });

    test("purges tokens from a v0 payload too", async () => {
        await rehydrate({ state: v1, version: 0 });
        expect(localStorage.getItem(MONERIUM_STORE_NAME)).not.toContain(
            "access-token"
        );
    });
});

describe("moneriumStore — hydration guard", () => {
    test.each([
        ["a non-object payload", "not-an-object"],
        ["an object missing the flag", {}],
        ["a wrongly typed flag", { hasSeenSetupSuccess: "yes" }],
    ])("degrades to the initial state on %s", async (_, state) => {
        moneriumStore.getState().markSetupSuccessSeen();
        await rehydrate({ state, version: 2 });
        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(false);
    });

    test("drops unknown keys instead of overwriting actions", async () => {
        await rehydrate({
            state: { hasSeenSetupSuccess: true, reset: null, extra: "x" },
            version: 2,
        });

        expect(() => moneriumStore.getState().reset()).not.toThrow();
        expect("extra" in moneriumStore.getState()).toBe(false);
    });
});
