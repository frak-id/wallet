import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../../tests/vitest-fixtures";
import {
    moneriumStore,
    selectAccessToken,
    selectIban,
    selectIbanLinkedAddress,
    selectIsConnected,
    selectIsTokenExpired,
    selectPendingCodeVerifier,
    selectProfileId,
    selectProfileState,
    selectRefreshToken,
} from "./moneriumStore";

describe("moneriumStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        moneriumStore.getState().disconnect();
    });

    describe("initial state", () => {
        test("should have correct initial values", () => {
            const state = moneriumStore.getState();

            expect(state.accessToken).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiry).toBeNull();
            expect(state.profileId).toBeNull();
            expect(state.profileState).toBeNull();
            expect(state.iban).toBeNull();
            expect(state.ibanLinkedAddress).toBeNull();
            expect(state.pendingCodeVerifier).toBeNull();
        });
    });

    describe("setTokens", () => {
        test("should set all token fields and compute expiry correctly", () => {
            const expiresIn = 3600; // 1 hour
            const beforeTime = Date.now();

            moneriumStore
                .getState()
                .setTokens(
                    "access-token-123",
                    "refresh-token-456",
                    expiresIn,
                    "profile-id-789"
                );

            const state = moneriumStore.getState();
            const afterTime = Date.now();

            expect(state.accessToken).toBe("access-token-123");
            expect(state.refreshToken).toBe("refresh-token-456");
            expect(state.profileId).toBe("profile-id-789");

            // Verify expiry is computed correctly: Date.now() + expiresIn * 1000
            const expectedExpiry = beforeTime + expiresIn * 1000;
            const actualExpiry = state.tokenExpiry;

            expect(actualExpiry).toBeDefined();
            expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry);
            expect(actualExpiry).toBeLessThanOrEqual(
                afterTime + expiresIn * 1000
            );
        });

        test("should work with selector", () => {
            moneriumStore
                .getState()
                .setTokens(
                    "access-token-123",
                    "refresh-token-456",
                    3600,
                    "profile-id-789"
                );

            const state = moneriumStore.getState();
            expect(selectAccessToken(state)).toBe("access-token-123");
            expect(selectRefreshToken(state)).toBe("refresh-token-456");
            expect(selectProfileId(state)).toBe("profile-id-789");
        });
    });

    describe("setProfileState", () => {
        test("should set profile state to created", () => {
            moneriumStore.getState().setProfileState("created");
            expect(moneriumStore.getState().profileState).toBe("created");
        });

        test("should set profile state to pending", () => {
            moneriumStore.getState().setProfileState("pending");
            expect(moneriumStore.getState().profileState).toBe("pending");
        });

        test("should set profile state to approved", () => {
            moneriumStore.getState().setProfileState("approved");
            expect(moneriumStore.getState().profileState).toBe("approved");
        });

        test("should set profile state to rejected", () => {
            moneriumStore.getState().setProfileState("rejected");
            expect(moneriumStore.getState().profileState).toBe("rejected");
        });

        test("should set profile state to blocked", () => {
            moneriumStore.getState().setProfileState("blocked");
            expect(moneriumStore.getState().profileState).toBe("blocked");
        });

        test("should work with selector", () => {
            moneriumStore.getState().setProfileState("approved");
            const state = moneriumStore.getState();
            expect(selectProfileState(state)).toBe("approved");
        });
    });

    describe("setIban", () => {
        test("should set IBAN and linked address", () => {
            const iban = "DE89370400440532013000";
            const linkedAddress = "0x1234567890123456789012345678901234567890";

            moneriumStore.getState().setIban(iban, linkedAddress);

            const state = moneriumStore.getState();
            expect(state.iban).toBe(iban);
            expect(state.ibanLinkedAddress).toBe(linkedAddress);
        });

        test("should work with selectors", () => {
            const iban = "DE89370400440532013000";
            const linkedAddress = "0x1234567890123456789012345678901234567890";

            moneriumStore.getState().setIban(iban, linkedAddress);

            const state = moneriumStore.getState();
            expect(selectIban(state)).toBe(iban);
            expect(selectIbanLinkedAddress(state)).toBe(linkedAddress);
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

        test("should work with selector", () => {
            const verifier = "code-verifier-abc123xyz";

            moneriumStore.getState().setPendingCodeVerifier(verifier);
            const state = moneriumStore.getState();
            expect(selectPendingCodeVerifier(state)).toBe(verifier);
        });
    });

    describe("disconnect", () => {
        test("should clear all fields to null", () => {
            // Set all fields
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600, "profile-id");
            moneriumStore.getState().setProfileState("approved");
            moneriumStore
                .getState()
                .setIban(
                    "DE89370400440532013000",
                    "0x1234567890123456789012345678901234567890"
                );
            moneriumStore.getState().setPendingCodeVerifier("code-verifier");

            // Verify all set
            let state = moneriumStore.getState();
            expect(state.accessToken).not.toBeNull();
            expect(state.refreshToken).not.toBeNull();
            expect(state.profileId).not.toBeNull();
            expect(state.profileState).not.toBeNull();
            expect(state.iban).not.toBeNull();
            expect(state.ibanLinkedAddress).not.toBeNull();
            expect(state.pendingCodeVerifier).not.toBeNull();

            // Disconnect
            moneriumStore.getState().disconnect();

            // Verify all cleared
            state = moneriumStore.getState();
            expect(state.accessToken).toBeNull();
            expect(state.refreshToken).toBeNull();
            expect(state.tokenExpiry).toBeNull();
            expect(state.profileId).toBeNull();
            expect(state.profileState).toBeNull();
            expect(state.iban).toBeNull();
            expect(state.ibanLinkedAddress).toBeNull();
            expect(state.pendingCodeVerifier).toBeNull();
        });
    });

    describe("selectIsConnected", () => {
        test("should return true when accessToken is set", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600, "profile-id");

            const state = moneriumStore.getState();
            expect(selectIsConnected(state)).toBe(true);
        });

        test("should return false when accessToken is null", () => {
            const state = moneriumStore.getState();
            expect(selectIsConnected(state)).toBe(false);
        });

        test("should return false after disconnect", () => {
            moneriumStore
                .getState()
                .setTokens("access-token", "refresh-token", 3600, "profile-id");
            moneriumStore.getState().disconnect();

            const state = moneriumStore.getState();
            expect(selectIsConnected(state)).toBe(false);
        });
    });

    describe("selectIsTokenExpired", () => {
        test("should return false when token is not expired", () => {
            const expiresIn = 3600; // 1 hour from now
            moneriumStore
                .getState()
                .setTokens(
                    "access-token",
                    "refresh-token",
                    expiresIn,
                    "profile-id"
                );

            const state = moneriumStore.getState();
            expect(selectIsTokenExpired(state)).toBe(false);
        });

        test("should return true when token is expired", () => {
            const expiresIn = -1; // Already expired
            moneriumStore
                .getState()
                .setTokens(
                    "access-token",
                    "refresh-token",
                    expiresIn,
                    "profile-id"
                );

            const state = moneriumStore.getState();
            expect(selectIsTokenExpired(state)).toBe(true);
        });

        test("should return false when tokenExpiry is null", () => {
            const state = moneriumStore.getState();
            expect(selectIsTokenExpired(state)).toBe(false);
        });

        test("should return true at exact expiry time", () => {
            moneriumStore.getState().setTokens(
                "access-token",
                "refresh-token",
                0, // Expires immediately
                "profile-id"
            );

            const state = moneriumStore.getState();
            expect(selectIsTokenExpired(state)).toBe(true);
        });
    });
});
