import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviousAuthenticatorModel } from "../../common/storage/PreviousAuthenticatorModel";
import {
    createMockAddress,
    createMockSdkSession,
    createMockSession,
} from "../../test/factories";
import { useLogin } from "./useLogin";

vi.mock("@frak-labs/app-essentials", () => ({
    WebAuthN: {
        rpId: "test.frak.id",
    },
}));

vi.mock("@simplewebauthn/browser", () => ({
    startAuthentication: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
    generateAuthenticationOptions: vi.fn(),
}));

vi.mock("../../common/analytics", () => ({
    trackAuthInitiated: vi.fn(() => Promise.resolve()),
    trackAuthCompleted: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        auth: {
            login: {
                post: vi.fn(),
            },
        },
    },
}));

vi.mock("../../stores/authenticationStore", () => ({
    authenticationStore: {
        getState: vi.fn(),
    },
    addLastAuthentication: vi.fn(),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        getState: vi.fn(),
    },
}));

vi.mock("../../stores/userStore", () => ({
    userStore: {
        getState: vi.fn(),
    },
}));

describe("useLogin", () => {
    let queryClient: QueryClient;
    let wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
    const mockAddress = createMockAddress();

    const mockAuthResponse = {
        id: "credential-id",
        rawId: "credential-id",
        response: {
            clientDataJSON: "client-data",
            authenticatorData: "auth-data",
            signature: "signature",
            userHandle: "user-handle",
        },
        type: "public-key" as const,
        clientExtensionResults: {},
        authenticatorAttachment: "platform" as const,
    };

    const mockAuthOptions = {
        challenge: "test-challenge",
        rpId: "test.frak.id",
        userVerification: "required" as const,
        timeout: 180000,
    };

    const mockSessionData = {
        ...createMockSession({ address: mockAddress, token: "session-token" }),
        sdkJwt: createMockSdkSession({ token: "sdk-token" }),
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
            },
        });
        wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it("should login successfully without specific authenticator", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");
        const { addLastAuthentication } = await import(
            "../../stores/authenticationStore"
        );

        const setLastWebAuthNAction = vi.fn();
        const setSession = vi.fn();
        const setSdkSession = vi.fn();
        const setUser = vi.fn();

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession,
            setSdkSession,
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser,
        } as any);
        vi.mocked(addLastAuthentication).mockResolvedValue(undefined);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(generateAuthenticationOptions).toHaveBeenCalledWith({
            rpID: "test.frak.id",
            userVerification: "required",
            allowCredentials: undefined,
            timeout: 180000,
        });
        expect(startAuthentication).toHaveBeenCalledWith({
            optionsJSON: mockAuthOptions,
        });
        expect(setLastWebAuthNAction).toHaveBeenCalledWith({
            wallet: mockAddress,
            signature: mockAuthResponse,
            msg: mockAuthOptions.challenge,
        });
        expect(setSession).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "webauthn",
                address: mockAddress,
                token: "session-token",
            })
        );
        expect(setSdkSession).toHaveBeenCalledWith(mockSessionData.sdkJwt);
        expect(setUser).toHaveBeenCalledWith({
            _id: mockAddress,
            username: "mocked-username",
        });
    });

    it("should login with specific authenticator", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");
        const { addLastAuthentication } = await import(
            "../../stores/authenticationStore"
        );

        const lastAuthentication: PreviousAuthenticatorModel = {
            authenticatorId: "specific-auth-id",
            transports: ["internal"],
            wallet: mockAddress,
        };

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction: vi.fn(),
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser: vi.fn(),
        } as any);
        vi.mocked(addLastAuthentication).mockResolvedValue(undefined);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await result.current.login({ lastAuthentication });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(generateAuthenticationOptions).toHaveBeenCalledWith({
            rpID: "test.frak.id",
            userVerification: "required",
            allowCredentials: [
                {
                    id: "specific-auth-id",
                    transports: ["internal"],
                },
            ],
            timeout: 180000,
        });
    });

    it("should track analytics events", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");
        const { trackAuthInitiated, trackAuthCompleted } = await import(
            "../../common/analytics"
        );

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction: vi.fn(),
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser: vi.fn(),
        } as any);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(trackAuthInitiated).toHaveBeenCalledWith("login", {
            method: "global",
        });
        expect(trackAuthCompleted).toHaveBeenCalledWith(
            "login",
            expect.objectContaining({
                type: "webauthn",
                address: mockAddress,
            })
        );
    });

    it("should handle authentication API errors", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );

        const mockError = new Error("Authentication failed");

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: null,
            error: mockError,
        } as any);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await expect(result.current.login(undefined)).rejects.toThrow(
            "Authentication failed"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    it("should handle WebAuthn startAuthentication errors", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );

        const mockError = new Error("User cancelled authentication");

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockRejectedValue(mockError);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await expect(result.current.login(undefined)).rejects.toThrow(
            "User cancelled authentication"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    it("should encode authentication response correctly", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction: vi.fn(),
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser: vi.fn(),
        } as any);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(authenticatedWalletApi.auth.login.post).toHaveBeenCalledWith({
            expectedChallenge: mockAuthOptions.challenge,
            authenticatorResponse: btoa(JSON.stringify(mockAuthResponse)),
        });
    });

    it("should call addLastAuthentication with session", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");
        const { addLastAuthentication } = await import(
            "../../stores/authenticationStore"
        );

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction: vi.fn(),
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser: vi.fn(),
        } as any);
        vi.mocked(addLastAuthentication).mockResolvedValue(undefined);

        const { result } = renderHook(() => useLogin(), { wrapper });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(addLastAuthentication).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "webauthn",
                address: mockAddress,
                token: "session-token",
            })
        );
    });

    it("should accept custom mutation options", async () => {
        const { startAuthentication } = await import("@simplewebauthn/browser");
        const { generateAuthenticationOptions } = await import(
            "@simplewebauthn/server"
        );
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");

        const onSuccess = vi.fn();

        vi.mocked(generateAuthenticationOptions).mockResolvedValue(
            mockAuthOptions
        );
        vi.mocked(startAuthentication).mockResolvedValue(mockAuthResponse);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: mockSessionData,
            error: null,
        } as any);
        vi.mocked(authenticationStore.getState).mockReturnValue({
            setLastWebAuthNAction: vi.fn(),
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);
        vi.mocked(userStore.getState).mockReturnValue({
            setUser: vi.fn(),
        } as any);

        const { result } = renderHook(() => useLogin({ onSuccess }), {
            wrapper,
        });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess.mock.calls[0][0]).toMatchObject({
            type: "webauthn",
            address: mockAddress,
        });
    });

    it("should return correct hook properties", () => {
        const { result } = renderHook(() => useLogin(), { wrapper });

        expect(result.current).toHaveProperty("isLoading");
        expect(result.current).toHaveProperty("isSuccess");
        expect(result.current).toHaveProperty("isError");
        expect(result.current).toHaveProperty("error");
        expect(result.current).toHaveProperty("login");
        expect(typeof result.current.login).toBe("function");
    });
});
