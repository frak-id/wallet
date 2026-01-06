/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useCreateRecoveryPasskey } from "./useCreateRecoveryPasskey";

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
    };
});

vi.mock("ox", () => ({
    WebAuthnP256: {
        createCredential: vi.fn(),
    },
}));

describe("useCreateRecoveryPasskey", () => {
    const mockFile: RecoveryFileContent = {
        initialWallet: {
            address: "0x1234567890123456789012345678901234567890",
            authenticatorId: "auth-id-123",
            publicKey: { x: "0x1234", y: "0x5678" },
        },
        guardianAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        guardianPrivateKeyEncrypted: "encrypted-key-base64",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.createRecoveryPasskey).toBeDefined();
        expect(result.current.createRecoveryPasskeyAsync).toBeDefined();
    });

    test("should create recovery passkey successfully", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        const mockCredential = {
            id: "new-credential-id",
            publicKey: { x: 123n, y: 456n },
            raw: { id: "raw-id", type: "public-key" },
        };

        const mockWalletResponse = {
            address: "0xnewwallet1234567890123456789012345678",
            authenticatorId: "new-auth-id",
            publicKey: { x: "0xabc", y: "0xdef" },
        };

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue(
            mockCredential as any
        );
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: mockWalletResponse,
            error: null,
        } as any);

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.createRecoveryPasskeyAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({ wallet: mockWalletResponse });
    });

    test("should pass previousWallet from recovery file", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123" },
            error: null,
        } as any);

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.createRecoveryPasskeyAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(authenticatedWalletApi.auth.register.post).toHaveBeenCalledWith(
            expect.objectContaining({
                previousWallet: mockFile.initialWallet.address,
            })
        );
    });

    test("should handle WebAuthn credential creation failure", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");

        vi.mocked(WebAuthnP256.createCredential).mockRejectedValue(
            new Error("User cancelled WebAuthn")
        );

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.createRecoveryPasskeyAsync({ file: mockFile })
        ).rejects.toThrow("User cancelled WebAuthn");

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
            publicKey: { x: 1n, y: 2n },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: null,
            error: new Error("Registration failed"),
        } as any);

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.createRecoveryPasskeyAsync({ file: mockFile })
        ).rejects.toThrow();
    });

    test("should not pass createFn when getTauriCreateFn returns undefined", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi, getTauriCreateFn } = await import(
            "@frak-labs/wallet-shared"
        );

        vi.mocked(getTauriCreateFn).mockReturnValue(undefined);
        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123" },
            error: null,
        } as any);

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.createRecoveryPasskeyAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(WebAuthnP256.createCredential).toHaveBeenCalledWith(
            expect.not.objectContaining({ createFn: expect.anything() })
        );
    });

    test("should pass createFn when getTauriCreateFn returns a function", async ({
        queryWrapper,
    }) => {
        const { WebAuthnP256 } = await import("ox");
        const { authenticatedWalletApi, getTauriCreateFn } = await import(
            "@frak-labs/wallet-shared"
        );

        const mockCreateFn = vi.fn();
        vi.mocked(getTauriCreateFn).mockReturnValue(mockCreateFn);
        vi.mocked(WebAuthnP256.createCredential).mockResolvedValue({
            id: "cred-id",
            publicKey: { x: 1n, y: 2n },
            raw: {},
        } as any);
        vi.mocked(authenticatedWalletApi.auth.register.post).mockResolvedValue({
            data: { address: "0x123" },
            error: null,
        } as any);

        const { result } = renderHook(() => useCreateRecoveryPasskey(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.createRecoveryPasskeyAsync({ file: mockFile });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(WebAuthnP256.createCredential).toHaveBeenCalledWith(
            expect.objectContaining({ createFn: mockCreateFn })
        );
    });
});
