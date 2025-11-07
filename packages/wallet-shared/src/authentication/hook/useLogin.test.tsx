import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { PreviousAuthenticatorModel } from "../../common/storage/PreviousAuthenticatorModel";
import { useLogin } from "./useLogin";

vi.mock("@frak-labs/app-essentials", () => ({
    WebAuthN: {
        rpId: "test.frak.id",
    },
}));

vi.mock("ox", () => ({
    WebAuthnP256: {
        sign: vi.fn(),
        getClientDataJSON: vi.fn(),
    },
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

    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should login successfully without specific authenticator", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
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

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(WebAuthnP256.sign).toHaveBeenCalledWith(
            expect.objectContaining({
                credentialId: undefined,
                rpId: "test.frak.id",
                userVerification: "required",
                challenge: expect.stringMatching(/^0x[a-f0-9]{64}$/),
            })
        );
        expect(setLastWebAuthNAction).toHaveBeenCalledWith(
            expect.objectContaining({
                wallet: mockAddress,
                signature: expect.objectContaining({
                    id: mockAuthResponse.id,
                    response: expect.objectContaining({
                        metadata: expect.any(Object),
                        signature: expect.any(Object),
                    }),
                }),
                challenge: expect.stringMatching(/^0x[a-f0-9]{64}$/),
            })
        );
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

    test("should login with specific authenticator", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
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

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.login({ lastAuthentication });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(WebAuthnP256.sign).toHaveBeenCalledWith(
            expect.objectContaining({
                credentialId: "specific-auth-id",
                rpId: "test.frak.id",
                userVerification: "required",
                challenge: expect.stringMatching(/^0x[a-f0-9]{64}$/),
            })
        );
    });

    test("should track analytics events", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
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

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

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

    test("should handle authentication API errors", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );

        const mockError = new Error("Authentication failed");

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
        vi.mocked(authenticatedWalletApi.auth.login.post).mockResolvedValue({
            data: null,
            error: mockError,
        } as any);

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.login(undefined)).rejects.toThrow(
            "Authentication failed"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(mockError);
    });

    test("should handle WebAuthn startAuthentication errors", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");

        const mockError = new Error("User cancelled authentication");

        vi.mocked(WebAuthnP256.sign).mockRejectedValue(mockError);

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.login(undefined)).rejects.toThrow(
            "User cancelled authentication"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should encode authentication response correctly", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.login(undefined);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(authenticatedWalletApi.auth.login.post).toHaveBeenCalledWith(
            expect.objectContaining({
                expectedChallenge: expect.stringMatching(/^0x[a-f0-9]{64}$/),
                authenticatorResponse: expect.any(String),
            })
        );

        // Verify the authenticatorResponse structure
        const callArgs = vi.mocked(authenticatedWalletApi.auth.login.post).mock
            .calls[0][0];
        const decodedResponse = JSON.parse(
            atob(callArgs.authenticatorResponse)
        );
        expect(decodedResponse).toEqual({
            id: mockAuthResponse.id,
            response: {
                metadata: expect.objectContaining({
                    credentialId: mockAuthResponse.id,
                    authenticatorData:
                        mockAuthResponse.response.authenticatorData,
                    clientDataJSON: mockAuthResponse.response.clientDataJSON,
                    challengeIndex: 23,
                }),
                signature: expect.objectContaining({
                    r: expect.any(String),
                    s: expect.any(String),
                }),
            },
        });
    });

    test("should call addLastAuthentication with session", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
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

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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

        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

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

    test("should accept custom mutation options", async ({
        queryWrapper,
        mockAddress,
        mockSession,
        mockSdkSession,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "../../common/api/backendClient"
        );
        const { authenticationStore } = await import(
            "../../stores/authenticationStore"
        );
        const { sessionStore } = await import("../../stores/sessionStore");
        const { userStore } = await import("../../stores/userStore");

        const onSuccess = vi.fn();

        const mockSessionData = {
            ...mockSession,
            address: mockAddress,
            token: "session-token",
            sdkJwt: { ...mockSdkSession, token: "sdk-token" },
        };

        vi.mocked(WebAuthnP256.sign).mockResolvedValue({
            metadata: {
                credentialId: mockAuthResponse.id,
                authenticatorData: mockAuthResponse.response
                    .authenticatorData as any,
                clientDataJSON: mockAuthResponse.response.clientDataJSON as any,
                challengeIndex: 23,
            },
            signature: {
                r: 123n,
                s: 456n,
            },
            raw: {
                id: mockAuthResponse.id,
            },
        } as any);
        vi.mocked(WebAuthnP256.getClientDataJSON).mockReturnValue({
            challenge: mockAuthOptions.challenge,
            origin: "https://test.frak.id",
            type: "webauthn.get",
        } as any);
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
            wrapper: queryWrapper.wrapper,
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

    test("should return correct hook properties", ({ queryWrapper }) => {
        const { result } = renderHook(() => useLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toHaveProperty("isLoading");
        expect(result.current).toHaveProperty("isSuccess");
        expect(result.current).toHaveProperty("isError");
        expect(result.current).toHaveProperty("error");
        expect(result.current).toHaveProperty("login");
        expect(typeof result.current.login).toBe("function");
    });
});
