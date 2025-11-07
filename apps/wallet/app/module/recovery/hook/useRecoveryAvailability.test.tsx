/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import * as recoveryActions from "@/module/recovery/action/get";
import { useRecoveryAvailability } from "@/module/recovery/hook/useRecoveryAvailability";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

// Mock the recovery action
vi.mock("@/module/recovery/action/get", () => ({
    getRecoveryAvailability: vi.fn(),
}));

describe("useRecoveryAvailability", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    // Use fixture mockAddress for consistent addresses
    const createMockRecoveryFile = (mockAddress: string): RecoveryFileContent =>
        ({
            initialWallet: {
                address: mockAddress,
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0x1234567890123456789012345678901234567890123456789012345678901234",
                },
                authenticatorId: "test-authenticator-id",
            },
            guardianAddress: "0x9876543210987654321098765432109876543210",
            guardianPrivateKeyEncrypted: "encrypted-key",
        }) as unknown as RecoveryFileContent;

    test("should return initial state", ({ queryWrapper, mockAddress }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);

        const { result } = renderHook(
            () =>
                useRecoveryAvailability({
                    file: mockRecoveryFile,
                    newAuthenticatorId: "test-auth-id",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        expect(result.current.recoveryAvailability).toBeUndefined();
        expect(result.current.isLoading).toBe(true);
    });

    test("should fetch recovery availability when file is provided", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const mockAvailability = {
            available: true,
            alreadyRecovered: false,
        };

        vi.spyOn(recoveryActions, "getRecoveryAvailability").mockResolvedValue(
            mockAvailability
        );

        const { result } = renderHook(
            () =>
                useRecoveryAvailability({
                    file: mockRecoveryFile,
                    newAuthenticatorId: "test-auth-id",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.recoveryAvailability).toEqual(mockAvailability);
        expect(recoveryActions.getRecoveryAvailability).toHaveBeenCalledWith({
            wallet: mockRecoveryFile.initialWallet.address,
            expectedGuardian: mockRecoveryFile.guardianAddress,
            newAuthenticatorId: "test-auth-id",
        });
    });

    test("should not fetch when wallet address is missing", ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const invalidFile = {
            ...mockRecoveryFile,
            initialWallet: { address: "" },
        };

        const { result } = renderHook(
            () =>
                useRecoveryAvailability({
                    file: invalidFile as RecoveryFileContent,
                    newAuthenticatorId: "test-auth-id",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        expect(result.current.recoveryAvailability).toBeUndefined();
    });

    test("should handle errors gracefully", async ({
        queryWrapper,
        mockAddress,
    }) => {
        const mockRecoveryFile = createMockRecoveryFile(mockAddress);
        const mockError = new Error("Recovery unavailable");
        vi.spyOn(recoveryActions, "getRecoveryAvailability").mockRejectedValue(
            mockError
        );

        const { result } = renderHook(
            () =>
                useRecoveryAvailability({
                    file: mockRecoveryFile,
                    newAuthenticatorId: "test-auth-id",
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });
});
