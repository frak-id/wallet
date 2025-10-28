/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/useRecoveryLocalAccount";
import * as decryptUtils from "@/module/recovery/utils/decrypt";

// Mock viem/accounts
vi.mock("viem/accounts", () => ({
    privateKeyToAccount: vi.fn((privateKey) => ({
        address: "0xAccountAddress",
        privateKey,
        signMessage: vi.fn(),
        signTransaction: vi.fn(),
        signTypedData: vi.fn(),
    })),
}));

// Mock decrypt utility
vi.mock("@/module/recovery/utils/decrypt", () => ({
    decryptPrivateKey: vi.fn(),
}));

describe("useRecoveryLocalAccount", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    const mockRecoveryFile: RecoveryFileContent = {
        initialWallet: {
            address: "0x1234567890123456789012345678901234567890",
            publicKey: {
                x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                y: "0x1234567890123456789012345678901234567890123456789012345678901234",
            },
            authenticatorId: "test-authenticator-id",
        },
        guardianAddress: "0x9876543210987654321098765432109876543210",
        guardianPrivateKeyEncrypted: "encrypted-private-key-data",
    } as unknown as RecoveryFileContent;

    it("should return initial state", () => {
        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper,
        });

        expect(result.current.recoveryLocalAccount).toBeUndefined();
        expect(result.current.isIdle).toBe(true);
    });

    it("should decrypt private key and create account", async () => {
        const mockPrivateKey = "0xprivatekey123";
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockResolvedValue(
            mockPrivateKey as `0x${string}`
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper,
        });

        result.current.getRecoveryLocalAccount({
            file: mockRecoveryFile,
            pass: "test-password",
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(decryptUtils.decryptPrivateKey).toHaveBeenCalledWith({
            pass: "test-password",
            guardianPrivateKeyEncrypted:
                mockRecoveryFile.guardianPrivateKeyEncrypted,
        });

        expect(result.current.recoveryLocalAccount).toMatchObject({
            address: "0xAccountAddress",
            privateKey: mockPrivateKey,
        });
    });

    it("should handle decryption errors", async () => {
        const mockError = new Error("Invalid password");
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper,
        });

        result.current.getRecoveryLocalAccount({
            file: mockRecoveryFile,
            pass: "wrong-password",
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });

    it("should support async mutation", async () => {
        const mockPrivateKey = "0xprivatekey123";
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockResolvedValue(
            mockPrivateKey as `0x${string}`
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper,
        });

        const account = await result.current.getRecoveryLocalAccountAsync({
            file: mockRecoveryFile,
            pass: "test-password",
        });

        expect(account).toMatchObject({
            address: "0xAccountAddress",
            privateKey: mockPrivateKey,
        });
    });
});
