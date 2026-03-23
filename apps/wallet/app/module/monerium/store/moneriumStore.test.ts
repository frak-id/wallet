import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../../tests/vitest-fixtures";
import {
    isMoneriumConnected,
    isMoneriumTokenExpired,
    moneriumStore,
} from "./moneriumStore";

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

    describe("setPendingCodeVerifier", () => {
        test("should set pending code verifier", () => {
            const verifier = "code-verifier-abc123xyz";

            moneriumStore.getState().setPendingCodeVerifier(verifier);
            expect(moneriumStore.getState().pendingCodeVerifier).toBe(verifier);
        });

        test("should clear pending code verifier when null", () => {
            moneriumStore
                .getState()
                .setPendingCodeVerifier("code-verifier-123");
            moneriumStore.getState().setPendingCodeVerifier(null);
            expect(moneriumStore.getState().pendingCodeVerifier).toBeNull();
        });
    });

    describe("disconnect", () => {
        test("should clear all fields to null", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600);
            moneriumStore.getState().setPendingCodeVerifier("code-verifier");

            let state = moneriumStore.getState();
            expect(state.accessToken).not.toBeNull();
            expect(state.refreshToken).not.toBeNull();

            moneriumStore.getState().disconnect();

            state = moneriumStore.getState();
            expect(state.accessToken).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiry).toBeNull();
            expect(state.pendingCodeVerifier).toBeNull();
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

    describe("isMoneriumTokenExpired", () => {
        test("should return false when token is not expired", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600);

            expect(isMoneriumTokenExpired(moneriumStore.getState())).toBe(
                false
            );
        });

        test("should return true when token is expired", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", -1);

            expect(isMoneriumTokenExpired(moneriumStore.getState())).toBe(true);
        });

        test("should return false when tokenExpiry is null", () => {
            expect(isMoneriumTokenExpired(moneriumStore.getState())).toBe(
                false
            );
        });

        test("should return true at exact expiry time", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 0);

            expect(isMoneriumTokenExpired(moneriumStore.getState())).toBe(true);
        });
    });
});
