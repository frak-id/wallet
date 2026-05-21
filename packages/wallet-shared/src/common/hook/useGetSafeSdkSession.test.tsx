import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import type { StoreApi } from "zustand/vanilla";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { LastWebAuthNAction } from "../../stores/types";
import type { SdkSession, Session } from "../../types/Session";
import { useGetSafeSdkSession } from "./useGetSafeSdkSession";

type MockSessionState = {
    sdkSession: SdkSession | null;
    session: Session | null;
    setSdkSession: (s: SdkSession | null) => void;
};

type MockAuthState = {
    lastWebAuthNAction: LastWebAuthNAction | null;
};

// Mock dependencies
vi.mock("../../stores/sessionStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        sessionStore: createStore<MockSessionState>(() => ({
            sdkSession: null,
            session: null,
            setSdkSession: () => {},
        })),
        selectSdkSession: vi.fn((state: MockSessionState) => state.sdkSession),
        selectSession: vi.fn((state: MockSessionState) => state.session),
    };
});

vi.mock("../../stores/authenticationStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        authenticationStore: createStore<MockAuthState>(() => ({
            lastWebAuthNAction: null,
        })),
        selectLastWebAuthNAction: vi.fn(
            (state: MockAuthState) => state.lastWebAuthNAction
        ),
    };
});

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
    let mockSetSdkSession: (sdkSession: SdkSession | null) => void;
    let mockSessionState: MockSessionState;
    let mockAuthState: MockAuthState;
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

        // `vi.mock` swaps the stores for vanilla stores typed against the
        // local `MockSessionState`/`MockAuthState`, but TypeScript resolves
        // the imports against the real `SessionStore`/`AuthenticationStore`
        // types. Cast through the mock shapes so `setState`/`getState`
        // remain fully typed (no `any` leakage).
        const { sessionStore } = (await import(
            "../../stores/sessionStore"
        )) as unknown as { sessionStore: StoreApi<MockSessionState> };
        const { authenticationStore } = (await import(
            "../../stores/authenticationStore"
        )) as unknown as { authenticationStore: StoreApi<MockAuthState> };

        // Setup mock store state - Proxy bridges property assignments to
        // vanilla store setState so existing test mutations still work.
        mockSetSdkSession = vi.fn();
        sessionStore.setState(
            {
                sdkSession: null,
                session: null,
                setSdkSession: mockSetSdkSession,
            },
            true
        );
        mockSessionState = new Proxy({} as MockSessionState, {
            get: (_, key) =>
                sessionStore.getState()[key as keyof MockSessionState],
            set: (_, key, value) => {
                sessionStore.setState({
                    [key as keyof MockSessionState]: value,
                });
                return true;
            },
        });

        authenticationStore.setState({ lastWebAuthNAction: null }, true);
        mockAuthState = new Proxy({} as MockAuthState, {
            get: (_, key) =>
                authenticationStore.getState()[key as keyof MockAuthState],
            set: (_, key, value) => {
                authenticationStore.setState({
                    [key as keyof MockAuthState]: value,
                });
                return true;
            },
        });

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
