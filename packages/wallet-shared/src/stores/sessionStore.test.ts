import type { Session } from "@frak-labs/wallet-shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
    createMockDistantWebAuthNSession,
    createMockEcdsaSession,
    createMockSdkSession,
    createMockSession,
} from "../test/factories";
import {
    selectDemoPrivateKey,
    selectDistantWebauthnSession,
    selectEcdsaSession,
    selectSdkSession,
    selectSession,
    selectWebauthnSession,
    sessionStore,
} from "./sessionStore";

describe("sessionStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        sessionStore.getState().clearSession();
    });

    describe("initial state", () => {
        it("should have correct initial values", () => {
            const state = sessionStore.getState();

            expect(state.session).toBeNull();
            expect(state.sdkSession).toBeNull();
            expect(state.demoPrivateKey).toBeNull();
        });
    });

    describe("setSession", () => {
        it("should set session", () => {
            const mockSession = createMockSession({ token: "test-token-123" });

            sessionStore.getState().setSession(mockSession);
            expect(sessionStore.getState().session).toEqual(mockSession);
        });

        it("should clear session when null", () => {
            const mockSession = createMockSession();

            sessionStore.getState().setSession(mockSession);
            sessionStore.getState().setSession(null);
            expect(sessionStore.getState().session).toBeNull();
        });

        it("should work with selector", () => {
            const mockSession = createMockSession();

            sessionStore.getState().setSession(mockSession);
            expect(selectSession(sessionStore.getState())).toEqual(mockSession);
        });
    });

    describe("setSdkSession", () => {
        it("should set SDK session", () => {
            const mockSdkSession = createMockSdkSession({
                token: "sdk-token-123",
            });

            sessionStore.getState().setSdkSession(mockSdkSession);
            expect(sessionStore.getState().sdkSession).toEqual(mockSdkSession);
        });

        it("should clear SDK session when null", () => {
            const mockSdkSession = createMockSdkSession({
                token: "sdk-token-123",
            });

            sessionStore.getState().setSdkSession(mockSdkSession);
            sessionStore.getState().setSdkSession(null);
            expect(sessionStore.getState().sdkSession).toBeNull();
        });

        it("should work with selector", () => {
            const mockSdkSession = createMockSdkSession({
                token: "sdk-token-123",
            });

            sessionStore.getState().setSdkSession(mockSdkSession);
            expect(selectSdkSession(sessionStore.getState())).toEqual(
                mockSdkSession
            );
        });
    });

    describe("setDemoPrivateKey", () => {
        it("should set demo private key", () => {
            const mockKey = "0xprivatekey123" as `0x${string}`;

            sessionStore.getState().setDemoPrivateKey(mockKey);
            expect(sessionStore.getState().demoPrivateKey).toBe(mockKey);
        });

        it("should clear demo private key when null", () => {
            const mockKey = "0xprivatekey123" as `0x${string}`;

            sessionStore.getState().setDemoPrivateKey(mockKey);
            sessionStore.getState().setDemoPrivateKey(null);
            expect(sessionStore.getState().demoPrivateKey).toBeNull();
        });

        it("should work with selector", () => {
            const mockKey = "0xprivatekey123" as `0x${string}`;

            sessionStore.getState().setDemoPrivateKey(mockKey);
            expect(selectDemoPrivateKey(sessionStore.getState())).toBe(mockKey);
        });
    });

    describe("clearSession", () => {
        it("should clear all session data", () => {
            const mockSession = createMockSession();
            const mockSdkSession = createMockSdkSession({
                token: "sdk-token-123",
            });
            const mockKey = "0xprivatekey123" as `0x${string}`;

            // Set all values
            sessionStore.getState().setSession(mockSession);
            sessionStore.getState().setSdkSession(mockSdkSession);
            sessionStore.getState().setDemoPrivateKey(mockKey);

            // Clear
            sessionStore.getState().clearSession();

            // Verify all cleared
            const state = sessionStore.getState();
            expect(state.session).toBeNull();
            expect(state.sdkSession).toBeNull();
            expect(state.demoPrivateKey).toBeNull();
        });
    });

    describe("selectWebauthnSession", () => {
        it("should return webauthn session", () => {
            const mockSession = createMockSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectWebauthnSession(sessionStore.getState());
            expect(result).toEqual(mockSession);
        });

        it("should return webauthn session when type is undefined", () => {
            const mockSession: Session = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            } as Session;

            sessionStore.getState().setSession(mockSession);
            const result = selectWebauthnSession(sessionStore.getState());
            expect(result).toEqual(mockSession);
        });

        it("should return null for non-webauthn session", () => {
            const mockSession = createMockEcdsaSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectWebauthnSession(sessionStore.getState());
            expect(result).toBeNull();
        });

        it("should return null when no session", () => {
            const result = selectWebauthnSession(sessionStore.getState());
            expect(result).toBeNull();
        });
    });

    describe("selectEcdsaSession", () => {
        it("should return ecdsa session", () => {
            const mockSession = createMockEcdsaSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectEcdsaSession(sessionStore.getState());
            expect(result).toEqual(mockSession);
        });

        it("should return null for non-ecdsa session", () => {
            const mockSession = createMockSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectEcdsaSession(sessionStore.getState());
            expect(result).toBeNull();
        });

        it("should return null when no session", () => {
            const result = selectEcdsaSession(sessionStore.getState());
            expect(result).toBeNull();
        });
    });

    describe("selectDistantWebauthnSession", () => {
        it("should return distant-webauthn session", () => {
            const mockSession = createMockDistantWebAuthNSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectDistantWebauthnSession(
                sessionStore.getState()
            );
            expect(result).toEqual(mockSession);
        });

        it("should return null for non-distant-webauthn session", () => {
            const mockSession = createMockSession();

            sessionStore.getState().setSession(mockSession);
            const result = selectDistantWebauthnSession(
                sessionStore.getState()
            );
            expect(result).toBeNull();
        });

        it("should return null when no session", () => {
            const result = selectDistantWebauthnSession(
                sessionStore.getState()
            );
            expect(result).toBeNull();
        });
    });
});
