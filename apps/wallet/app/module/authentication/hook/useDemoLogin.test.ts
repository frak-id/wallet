/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useDemoLogin } from "./useDemoLogin";

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        authenticatedWalletApi: {
            auth: {
                ecdsaLogin: {
                    post: vi.fn(),
                },
            },
        },
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

vi.mock("viem/accounts", () => ({
    generatePrivateKey: vi.fn(
        () =>
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    ),
    privateKeyToAccount: vi.fn(() => ({
        address: "0xDemoWallet123456789012345678901234567890",
        signMessage: vi.fn().mockResolvedValue("0xsignature"),
    })),
}));

describe("useDemoLogin", () => {
    const mockPrivateKey: Hex =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.mutate).toBeDefined();
        expect(result.current.mutateAsync).toBeDefined();
    });

    test("should login successfully with demo credentials", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );

        const mockSession = {
            address: "0xDemoWallet123456789012345678901234567890",
            authenticatorId: "demo-auth",
        };

        const setSession = vi.fn();
        const setSdkSession = vi.fn();

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: { ...mockSession, token: "demo-token", sdkJwt: "sdk-jwt" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession,
            setSdkSession,
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ pkey: mockPrivateKey });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(setSession).toHaveBeenCalled();
        expect(setSdkSession).toHaveBeenCalledWith("sdk-jwt");
    });

    test("should track authentication events", async ({ queryWrapper }) => {
        const {
            authenticatedWalletApi,
            sessionStore,
            trackAuthInitiated,
            trackAuthCompleted,
        } = await import("@frak-labs/wallet-shared");

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ pkey: mockPrivateKey });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(trackAuthInitiated).toHaveBeenCalledWith("demo");
        expect(trackAuthCompleted).toHaveBeenCalledWith(
            "demo",
            expect.any(Object)
        );
    });

    test("should sign message with private key", async ({ queryWrapper }) => {
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );
        const { privateKeyToAccount } = await import("viem/accounts");

        const mockSignMessage = vi.fn().mockResolvedValue("0xsignature");
        vi.mocked(privateKeyToAccount).mockReturnValue({
            address: "0xDemoWallet123456789012345678901234567890",
            signMessage: mockSignMessage,
        } as any);

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ pkey: mockPrivateKey });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(mockSignMessage).toHaveBeenCalled();
    });

    test("should handle login failure", async ({ queryWrapper }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: null,
            error: new Error("Demo login failed"),
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.mutateAsync({ pkey: mockPrivateKey })
        ).rejects.toThrow();

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should pass demo private key to API", async ({ queryWrapper }) => {
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: { address: "0x123", token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ pkey: mockPrivateKey });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                demoPkey: mockPrivateKey,
            })
        );
    });

    test("should return session after successful login", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi, sessionStore } = await import(
            "@frak-labs/wallet-shared"
        );

        const mockSessionData = {
            address: "0xDemoWallet123456789012345678901234567890",
            authenticatorId: "demo-auth",
            publicKey: { x: "0x1", y: "0x2" },
        };

        vi.mocked(
            authenticatedWalletApi.auth.ecdsaLogin.post
        ).mockResolvedValue({
            data: { ...mockSessionData, token: "token", sdkJwt: "sdk" },
            error: null,
        } as any);
        vi.mocked(sessionStore.getState).mockReturnValue({
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        } as any);

        const { result } = renderHook(() => useDemoLogin(), {
            wrapper: queryWrapper.wrapper,
        });

        const session = await result.current.mutateAsync({
            pkey: mockPrivateKey,
        });

        expect(session).toMatchObject({
            address: mockSessionData.address,
            token: "token",
        });
    });
});
