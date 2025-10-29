/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useRecoveryLocalAccount } from "@/module/recovery/hook/useRecoveryLocalAccount";
import * as decryptUtils from "@/module/recovery/utils/decrypt";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockRecoveryFile = (
        address: `0x${string}`
    ): RecoveryFileContent =>
        ({
            initialWallet: {
                address,
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0x1234567890123456789012345678901234567890123456789012345678901234",
                },
                authenticatorId: "test-authenticator-id",
            },
            guardianAddress: "0x9876543210987654321098765432109876543210",
            guardianPrivateKeyEncrypted: "encrypted-private-key-data",
        }) as unknown as RecoveryFileContent;

    test("should return initial state", ({ queryWrapper }) => {
        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.recoveryLocalAccount).toBeUndefined();
        expect(result.current.isIdle).toBe(true);
    });

    test("should decrypt private key and create account", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const mockPrivateKey = "0xprivatekey123";
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockResolvedValue(
            mockPrivateKey as `0x${string}`
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper: queryWrapper.wrapper,
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

    test("should handle decryption errors", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const mockError = new Error("Invalid password");
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper: queryWrapper.wrapper,
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

    test("should support async mutation", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const mockPrivateKey = "0xprivatekey123";
        vi.spyOn(decryptUtils, "decryptPrivateKey").mockResolvedValue(
            mockPrivateKey as `0x${string}`
        );

        const { result } = renderHook(() => useRecoveryLocalAccount(), {
            wrapper: queryWrapper.wrapper,
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
