/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useRegister } from "./useRegister";

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        authenticatedWalletApi: {
            auth: {
                register: {
                    post: vi.fn(),
                },
            },
        },
        getRegisterOptions: vi.fn(() => ({
            name: "Frak Wallet",
            challenge: new Uint8Array([1, 2, 3, 4]),
        })),
        getTauriCreateFn: vi.fn(() => undefined),
        addLastAuthentication: vi.fn(),
        sessionStore: {
            getState: vi.fn(() => ({
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
            })),
        },
        trackAuthCompleted: vi.fn(() => Promise.resolve()),
        trackAuthInitiated: vi.fn(() => Promise.resolve()),
    };
});

vi.mock("ox", () => ({
    WebAuthnP256: {
        createCredential: vi.fn(),
    },
}));

vi.mock("@/module/authentication/hook/usePreviousAuthenticators", () => ({
    usePreviousAuthenticators: vi.fn(() => ({
        data: undefined,
        isLoading: false,
    })),
}));

describe("useRegister", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isRegisterInProgress).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.register).toBeDefined();
    });

    test("should register successfully and store session", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi, addLastAuthentication, sessionStore } =
            await import("@frak-labs/wallet-shared");

        const mockCredential = {
            id: "credential-id",
            publicKey: { x: 123n, y: 456n, prefix: 4 },
            raw: { id: "raw-id", type: "public-key" },
        };

        const mockSession = {
            address: "0x1234567890123456789012345678901234567890",
            authenticatorId: "auth-id",
            publicKey: { x: "0x1234", y: "0x5678" },
        };

        const setSession = vi.fn();
        const setSdkSession = vi.fn();

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(
            mockCredential as any
        );
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { ...mockSession, token: "jwt-token", sdkJwt: "sdk-jwt" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession,
            setSdkSession,
        } as any);

        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.register();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(addLastAuthentication).toHaveBeenCalled();
        expect(setSession).toHaveBeenCalled();
        expect(setSdkSession).toHaveBeenCalledWith("sdk-jwt");
    });

    test("should track authentication events", async ({ queryWrapper }) => {
        const { WebAuthnP256 } = await import("ox");
        const {
            authenticatedWalletApi,
            trackAuthInitiated,
            trackAuthCompleted,
            sessionStore,
        } = await import("@frak-labs/wallet-shared");

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n, prefix: 4 },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.register();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(trackAuthInitiated).toHaveBeenCalledWith("register");
        expect(trackAuthCompleted).toHaveBeenCalledWith(
            "register",
            expect.any(Object)
        );
    });

    test("should exclude previous authenticators", async ({ queryWrapper }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );
        const { usePreviousAuthenticators } = await import(
            "@/module/authentication/hook/usePreviousAuthenticators"
        );

        const previousAuthenticators = [
            { authenticatorId: "prev-auth-1" },
            { authenticatorId: "prev-auth-2" },
        ];

        vi.mocked(usePreviousAuthenticators).mockReturnValue({
            data: previousAuthenticators,
            isLoading: false,
        } as any);

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n, prefix: 4 },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.register();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(WebAuthnP256.createCredential).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeCredentialIds: ["prev-auth-1", "prev-auth-2"],
            })
        );
    });

    test("should handle WebAuthn credential creation failure", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");

        vi.mocked(WebAuthnP256.createCredential).mockRejectedValue(
            new Error("User cancelled")
        );

        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.register()).rejects.toThrow(
            "User cancelled"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should handle API registration failure", async ({ queryWrapper }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n, prefix: 4 },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: null,
            error: new Error("Registration failed on server"),
        } as any);

        const { result } = renderHook(() => useRegister(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.register()).rejects.toThrow();

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should accept custom mutation options", async ({ queryWrapper }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n, prefix: 4 },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const onSuccess = vi.fn();

        const { result } = renderHook(() => useRegister({ onSuccess }), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.register();

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
    });
});
