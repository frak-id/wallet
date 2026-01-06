import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { LastWebAuthNAction } from "../../stores/types";
import { useGetSafeSdkSession } from "./useGetSafeSdkSession";

// Mock dependencies
vi.mock("../../stores/sessionStore", () => ({
    sessionStore: vi.fn(),
    selectSdkSession: vi.fn((state) => state.sdkSession),
    selectSession: vi.fn((state) => state.session),
}));

vi.mock("../../stores/authenticationStore", () => ({
    authenticationStore: vi.fn(),
    selectLastWebAuthNAction: vi.fn((state) => state.lastWebAuthNAction),
}));

vi.mock("../api/backendClient", () => ({
    authenticatedWalletApi: {
        auth: {
            sdk: {
                isValid: {
                    get: vi.fn(),
                },
                fromWebAuthNSignature: {
                    post: vi.fn(),
                },
                generate: {
                    get: vi.fn(),
                },
            },
        },
    },
}));

vi.mock("../utils/safeSession", () => ({
    getSafeSdkSession: vi.fn(),
    getSafeSession: vi.fn(),
}));

vi.mock("../queryKeys/sdk", () => ({
    sdkKey: {
        token: {
            bySession: vi.fn((address, wallet) => [
                "sdk",
                "token",
                address ?? "no-session",
                wallet ?? "no-last-action",
            ]),
        },
    },
}));

describe("useGetSafeSdkSession", () => {
    let mockSetSdkSession: (sdkSession: any) => void;
    let mockSessionState: {
        sdkSession: null | ReturnType<
            typeof import("../../test/factories").createMockSdkSession
        >;
        session: null | ReturnType<
            typeof import("../../test/factories").createMockSession
        >;
        setSdkSession: (sdkSession: any) => void;
    };
    let mockAuthState: {
        lastWebAuthNAction: LastWebAuthNAction | null;
    };
    let mockBackendAPI: {
        isValid: { get: ReturnType<typeof vi.fn> };
        fromWebAuthNSignature: { post: ReturnType<typeof vi.fn> };
        generate: { get: ReturnType<typeof vi.fn> };
    };
    let mockSafeSession: {
        getSafeSdkSession: ReturnType<typeof vi.fn>;
        getSafeSession: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mock store state
        mockSetSdkSession = vi.fn();
        mockSessionState = {
            sdkSession: null,
            session: null,
            setSdkSession: mockSetSdkSession,
        };
        mockAuthState = {
            lastWebAuthNAction: null,
        };

        const { sessionStore, selectSdkSession, selectSession } = await import(
            "../../stores/sessionStore"
        );
        // Mock sessionStore to work with selectors (Zustand stores are functions)
        vi.mocked(sessionStore).mockImplementation((selector: any) => {
            // Zustand stores accept selector functions
            if (typeof selector === "function") {
                return selector(mockSessionState);
            }
            // Fallback if called without selector
            return mockSessionState;
        });
        // Selectors are just functions, no need to mock them differently
        vi.mocked(selectSdkSession).mockImplementation(
            (state: typeof mockSessionState) => state.sdkSession
        );
        vi.mocked(selectSession).mockImplementation(
            (state: typeof mockSessionState) => state.session
        );

        const { authenticationStore, selectLastWebAuthNAction } = await import(
            "../../stores/authenticationStore"
        );
        // Mock authenticationStore to work with selectors
        vi.mocked(authenticationStore).mockImplementation((selector: any) => {
            if (typeof selector === "function") {
                return selector(mockAuthState);
            }
            return mockAuthState;
        });
        vi.mocked(selectLastWebAuthNAction).mockImplementation(
            (state: { lastWebAuthNAction: LastWebAuthNAction | null }) =>
                state.lastWebAuthNAction
        );

        // Setup mock API
        const { authenticatedWalletApi } = await import("../api/backendClient");
        mockBackendAPI = {
            isValid: {
                get: vi.mocked(authenticatedWalletApi.auth.sdk.isValid.get),
            },
            fromWebAuthNSignature: {
                post: vi.mocked(
                    authenticatedWalletApi.auth.sdk.fromWebAuthNSignature.post
                ),
            },
            generate: {
                get: vi.mocked(authenticatedWalletApi.auth.sdk.generate.get),
            },
        };

        // Setup mock safe session utilities
        const safeSession = await import("../utils/safeSession");
        mockSafeSession = {
            getSafeSdkSession: vi.mocked(safeSession.getSafeSdkSession),
            getSafeSession: vi.mocked(safeSession.getSafeSession),
        };
    });

    afterEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        // Reset mock state
        mockSessionState.sdkSession = null;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = null;
    });

    test("should return sdkSession and query state", ({ queryWrapper }) => {
        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toHaveProperty("sdkSession");
        expect(result.current).toHaveProperty("getSdkSession");
        expect(result.current).toHaveProperty("isLoading");
        expect(result.current).toHaveProperty("isError");
        expect(result.current).toHaveProperty("data");
    });

    test("should return valid sdkSession when current session is valid", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        // Setup: current SDK session exists and is valid
        mockSessionState.sdkSession = mockSdkSession;
        mockSessionState.session = null;

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: { isValid: true },
            error: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toEqual(mockSdkSession);
        expect(mockBackendAPI.isValid.get).toHaveBeenCalledWith({
            headers: {
                "x-wallet-sdk-auth": mockSdkSession.token,
            },
        });
        expect(
            mockBackendAPI.fromWebAuthNSignature.post
        ).not.toHaveBeenCalled();
        expect(mockBackendAPI.generate.get).not.toHaveBeenCalled();
    });

    test("should regenerate session from WebAuthN action when current session is invalid", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        const mockWebAuthNAction: LastWebAuthNAction = {
            signature: {
                id: "cred-123",
                response: {
                    metadata: {
                        authenticatorData: "0x1234",
                        challengeIndex: 0,
                        clientDataJSON: "test-client-data",
                        typeIndex: 0,
                        userVerificationRequired: true,
                    },
                    signature: {
                        r: 0n,
                        s: 0n,
                        yParity: 0,
                    },
                },
            },
            challenge: "0x746573742d6d657373616765" as `0x${string}`,
            wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };

        const newSdkSession = {
            ...mockSdkSession,
            token: "new-sdk-token",
        };

        // Setup: current SDK session exists but is invalid
        mockSessionState.sdkSession = mockSdkSession;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = mockWebAuthNAction;

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: { isValid: false },
            error: null,
        });

        mockBackendAPI.fromWebAuthNSignature.post.mockResolvedValue({
            data: newSdkSession,
            error: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toEqual(newSdkSession);
        expect(mockSetSdkSession).toHaveBeenCalledWith(newSdkSession);
        expect(mockBackendAPI.fromWebAuthNSignature.post).toHaveBeenCalledWith({
            signature: btoa(JSON.stringify(mockWebAuthNAction.signature)),
            challenge: mockWebAuthNAction.challenge,
            wallet: mockWebAuthNAction.wallet,
        });
    });

    test("should generate new session from cookie when no WebAuthN action", async ({
        queryWrapper,
        mockSession,
        mockSdkSession,
    }) => {
        // Setup: no current SDK session, no WebAuthN action, but has user session
        mockSessionState.sdkSession = null;
        mockSessionState.session = mockSession;
        mockAuthState.lastWebAuthNAction = null;

        mockSafeSession.getSafeSdkSession.mockReturnValue(null);
        mockSafeSession.getSafeSession.mockReturnValue(mockSession);

        mockBackendAPI.generate.get.mockResolvedValue({
            data: mockSdkSession,
            error: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toEqual(mockSdkSession);
        expect(mockSetSdkSession).toHaveBeenCalledWith(mockSdkSession);
        expect(mockBackendAPI.generate.get).toHaveBeenCalled();
    });

    test("should return null when no session and no WebAuthN action", async ({
        queryWrapper,
    }) => {
        // Setup: no sessions at all
        mockSessionState.sdkSession = null;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = null;

        mockSafeSession.getSafeSdkSession.mockReturnValue(null);
        mockSafeSession.getSafeSession.mockReturnValue(null);

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toBeNull();
        expect(mockBackendAPI.generate.get).not.toHaveBeenCalled();
    });

    test("should handle error when validating session", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        mockSessionState.sdkSession = mockSdkSession;
        mockSessionState.session = null;

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: null,
            error: { status: 500, value: "Server error" },
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should try to regenerate from WebAuthN or generate new
        expect(mockBackendAPI.isValid.get).toHaveBeenCalled();
    });

    test("should handle error when generating from WebAuthN signature", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        const mockWebAuthNAction: LastWebAuthNAction = {
            signature: {
                id: "cred-123",
                response: {
                    metadata: {
                        authenticatorData: "0x1234",
                        challengeIndex: 0,
                        clientDataJSON: "test-client-data",
                        typeIndex: 0,
                        userVerificationRequired: true,
                    },
                    signature: {
                        r: 0n,
                        s: 0n,
                        yParity: 0,
                    },
                },
            },
            challenge: "0x746573742d6d657373616765" as `0x${string}`,
            wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };

        mockSessionState.sdkSession = mockSdkSession;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = mockWebAuthNAction;

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: { isValid: false },
            error: null,
        });

        mockBackendAPI.fromWebAuthNSignature.post.mockResolvedValue({
            data: null,
            error: { status: 400, value: "Invalid signature" },
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            "Unable to generate a new token from previous signature",
            { status: 400, value: "Invalid signature" }
        );

        consoleSpy.mockRestore();
    });

    test("should handle error when generating from cookie", async ({
        queryWrapper,
        mockSession,
    }) => {
        mockSessionState.sdkSession = null;
        mockSessionState.session = mockSession;

        mockSafeSession.getSafeSdkSession.mockReturnValue(null);
        mockSafeSession.getSafeSession.mockReturnValue(mockSession);

        mockBackendAPI.generate.get.mockResolvedValue({
            data: null,
            error: { status: 403, value: "Forbidden" },
        });

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
            "Unable to generate a new token",
            { status: 403, value: "Forbidden" }
        );

        consoleSpy.mockRestore();
    });

    test("should use getSafeSdkSession as fallback when store is empty", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        const fallbackSdkSession = {
            ...mockSdkSession,
            token: "fallback-token",
        };

        mockSessionState.sdkSession = null;
        mockSessionState.session = null;

        mockSafeSession.getSafeSdkSession.mockReturnValue(fallbackSdkSession);

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: { isValid: true },
            error: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.sdkSession).toEqual(fallbackSdkSession);
        expect(mockBackendAPI.isValid.get).toHaveBeenCalledWith({
            headers: {
                "x-wallet-sdk-auth": fallbackSdkSession.token,
            },
        });
    });

    test("should use getSafeSession as fallback when generating from cookie", async ({
        queryWrapper,
        mockSession,
        mockSdkSession,
    }) => {
        mockSessionState.sdkSession = null;
        mockSessionState.session = null;

        mockSafeSession.getSafeSdkSession.mockReturnValue(null);
        mockSafeSession.getSafeSession.mockReturnValue(mockSession);

        mockBackendAPI.generate.get.mockResolvedValue({
            data: mockSdkSession,
            error: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockSafeSession.getSafeSession).toHaveBeenCalled();
        expect(mockBackendAPI.generate.get).toHaveBeenCalled();
    });

    test("should encode WebAuthN signature correctly", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        const mockWebAuthNAction: LastWebAuthNAction = {
            signature: {
                id: "cred-123",
                response: {
                    metadata: {
                        authenticatorData: "0x1234",
                        challengeIndex: 0,
                        clientDataJSON: "test-client-data",
                        typeIndex: 0,
                        userVerificationRequired: true,
                    },
                    signature: {
                        r: 0n,
                        s: 0n,
                        yParity: 0,
                    },
                },
            },
            challenge: "0x746573742d6d657373616765" as `0x${string}`,
            wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };

        mockSessionState.sdkSession = mockSdkSession;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = mockWebAuthNAction;

        mockBackendAPI.isValid.get.mockResolvedValue({
            data: { isValid: false },
            error: null,
        });

        mockBackendAPI.fromWebAuthNSignature.post.mockResolvedValue({
            data: mockSdkSession,
            error: null,
        });

        renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(
                mockBackendAPI.fromWebAuthNSignature.post
            ).toHaveBeenCalled();
        });

        const callArgs =
            mockBackendAPI.fromWebAuthNSignature.post.mock.calls[0][0];
        expect(callArgs.signature).toBe(
            btoa(JSON.stringify(mockWebAuthNAction.signature))
        );
        expect(callArgs.challenge).toBe(mockWebAuthNAction.challenge);
        expect(callArgs.wallet).toBe(mockWebAuthNAction.wallet);
    });

    test("should expose getSdkSession refetch function", ({ queryWrapper }) => {
        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(typeof result.current.getSdkSession).toBe("function");
    });

    test("should update query key when session address changes", async ({
        queryWrapper,
        mockSession,
        mockSdkSession,
    }) => {
        const { sdkKey } = await import("../queryKeys/sdk");

        mockSessionState.sdkSession = null;
        mockSessionState.session = mockSession;

        mockSafeSession.getSafeSession.mockReturnValue(mockSession);

        mockBackendAPI.generate.get.mockResolvedValue({
            data: mockSdkSession,
            error: null,
        });

        renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(mockBackendAPI.generate.get).toHaveBeenCalled();
        });

        const firstCall = vi.mocked(sdkKey.token.bySession).mock.calls[0];
        // The hook passes undefined when lastWebAuthnAction is null
        expect(firstCall).toEqual([mockSession.address, undefined]);
    });

    test("should update query key when WebAuthN wallet changes", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        const mockWebAuthNAction: LastWebAuthNAction = {
            signature: {
                id: "cred-123",
                response: {
                    metadata: {
                        authenticatorData: "0x1234",
                        challengeIndex: 0,
                        clientDataJSON: "test-client-data",
                        typeIndex: 0,
                        userVerificationRequired: true,
                    },
                    signature: {
                        r: 0n,
                        s: 0n,
                        yParity: 0,
                    },
                },
            },
            challenge: "0x746573742d6d657373616765" as `0x${string}`,
            wallet: "0x1111111111111111111111111111111111111111" as `0x${string}`,
        };

        const { sdkKey } = await import("../queryKeys/sdk");

        mockSessionState.sdkSession = null;
        mockSessionState.session = null;
        mockAuthState.lastWebAuthNAction = mockWebAuthNAction;

        mockBackendAPI.fromWebAuthNSignature.post.mockResolvedValue({
            data: mockSdkSession,
            error: null,
        });

        renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(
                mockBackendAPI.fromWebAuthNSignature.post
            ).toHaveBeenCalled();
        });

        const firstCall = vi.mocked(sdkKey.token.bySession).mock.calls[0];
        // The hook passes undefined when session is null
        expect(firstCall).toEqual([undefined, mockWebAuthNAction.wallet]);
    });
});
