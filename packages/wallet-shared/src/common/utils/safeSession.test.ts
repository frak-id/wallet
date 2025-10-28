import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SdkSession, Session } from "../../types/Session";
import { getSafeSdkSession, getSafeSession } from "./safeSession";

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    return {
        ...actual,
        sessionStore: {
            getState: vi.fn(),
        },
    };
});

describe("safeSession utilities", () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe("getSafeSession", () => {
        it("should return session from store when available", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            const mockSession: Session = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: {
                    x: "0xabc" as `0x${string}`,
                    y: "0xdef" as `0x${string}`,
                },
                authenticatorId: "auth-123",
                token: "session-token",
            };

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSession();

            expect(result).toEqual(mockSession);
        });

        it("should return session from localStorage when store is empty", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const mockSession: Session = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: {
                    x: "0xabc" as `0x${string}`,
                    y: "0xdef" as `0x${string}`,
                },
                authenticatorId: "auth-123",
                token: "session-token",
            };

            localStorage.setItem(
                "frak_session_store",
                JSON.stringify({
                    state: { session: mockSession },
                })
            );

            const result = getSafeSession();

            expect(result).toEqual(mockSession);
        });

        it("should return null when session is not available anywhere", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSession();

            expect(result).toBeNull();
        });

        it("should return null when localStorage has invalid data", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            localStorage.setItem("frak_session_store", "invalid-json");

            expect(() => getSafeSession()).toThrow();
        });
    });

    describe("getSafeSdkSession", () => {
        it("should return SDK session from store when available", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            const mockSdkSession: SdkSession = {
                token: "sdk-token",
                expires: Date.now() + 3600000,
            };

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: mockSdkSession,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSdkSession();

            expect(result).toEqual(mockSdkSession);
        });

        it("should return SDK session from localStorage when store is empty", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const mockSdkSession: SdkSession = {
                token: "sdk-token",
                expires: Date.now() + 3600000,
            };

            localStorage.setItem(
                "frak_session_store",
                JSON.stringify({
                    state: { sdkSession: mockSdkSession },
                })
            );

            const result = getSafeSdkSession();

            expect(result).toEqual(mockSdkSession);
        });

        it("should return null when SDK session is not available anywhere", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSdkSession();

            expect(result).toBeNull();
        });

        it("should prioritize store over localStorage", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            const storeSdkSession: SdkSession = {
                token: "store-token",
                expires: Date.now() + 3600000,
            };

            const localStorageSdkSession: SdkSession = {
                token: "localstorage-token",
                expires: Date.now() + 7200000,
            };

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: storeSdkSession,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            localStorage.setItem(
                "frak_session_store",
                JSON.stringify({
                    state: { sdkSession: localStorageSdkSession },
                })
            );

            const result = getSafeSdkSession();

            expect(result).toEqual(storeSdkSession);
        });
    });

    describe("getFromLocalStorage", () => {
        it("should handle missing localStorage items", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            // Ensure key doesn't exist
            localStorage.removeItem("frak_session_store");

            const result = getSafeSession();

            expect(result).toBeNull();
        });
    });
});
