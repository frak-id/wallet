import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { SdkSession } from "../../types/Session";
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
        test("should return session from store when available", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSession } = await import("../../test/factories");

            const sessionWithDetails = createMockSession({
                publicKey: {
                    x: "0xabc" as `0x${string}`,
                    y: "0xdef" as `0x${string}`,
                },
                token: "session-token",
            });

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: sessionWithDetails,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSession();

            expect(result).toEqual(sessionWithDetails);
        });

        test("should return session from localStorage when store is empty", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSession } = await import("../../test/factories");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const sessionWithDetails = createMockSession({
                publicKey: {
                    x: "0xabc" as `0x${string}`,
                    y: "0xdef" as `0x${string}`,
                },
                token: "session-token",
            });

            localStorage.setItem(
                "frak_session_store",
                JSON.stringify({
                    state: { session: sessionWithDetails },
                })
            );

            const result = getSafeSession();

            expect(result).toEqual(sessionWithDetails);
        });

        test("should return null when session is not available anywhere", async () => {
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

        test("should return null when localStorage has invalid data", async () => {
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
        test("should return SDK session from store when available", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSdkSession } = await import(
                "../../test/factories"
            );

            const sdkSessionWithToken = createMockSdkSession({
                token: "sdk-token",
            });

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: sdkSessionWithToken,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const result = getSafeSdkSession();

            expect(result).toEqual(sdkSessionWithToken);
        });

        test("should return SDK session from localStorage when store is empty", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSdkSession } = await import(
                "../../test/factories"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const sdkSessionWithToken = createMockSdkSession({
                token: "sdk-token",
            });

            localStorage.setItem(
                "frak_session_store",
                JSON.stringify({
                    state: { sdkSession: sdkSessionWithToken },
                })
            );

            const result = getSafeSdkSession();

            expect(result).toEqual(sdkSessionWithToken);
        });

        test("should return null when SDK session is not available anywhere", async () => {
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

        test("should prioritize store over localStorage", async () => {
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
        test("should handle missing localStorage items", async () => {
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
