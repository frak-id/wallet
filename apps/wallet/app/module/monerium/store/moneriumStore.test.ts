import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../../tests/vitest-fixtures";
import { isMoneriumConnected, moneriumStore } from "./moneriumStore";

describe("moneriumStore", () => {
    beforeEach(() => {
        moneriumStore.getState().disconnect();
    });

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
        test("should set verifier and state together", () => {
            moneriumStore
                .getState()
                .setPendingAuth("verifier-abc", "state-xyz");

            const state = moneriumStore.getState();
            expect(state.pendingCodeVerifier).toBe("verifier-abc");
            expect(state.pendingState).toBe("state-xyz");
        });

        test("should clear both verifier and state", () => {
            moneriumStore
                .getState()
                .setPendingAuth("verifier-abc", "state-xyz");
            moneriumStore.getState().clearPendingAuth();

            const state = moneriumStore.getState();
            expect(state.pendingCodeVerifier).toBeNull();
            expect(state.pendingState).toBeNull();
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
