/** @jsxImportSource react */
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as recoveryActions from "@/module/recovery/action/get";
import { useRecoveryAvailability } from "@/module/recovery/hook/useRecoveryAvailability";

// Mock the recovery action
vi.mock("@/module/recovery/action/get", () => ({
    getRecoveryAvailability: vi.fn(),
}));

describe("useRecoveryAvailability", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
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
        guardianPrivateKeyEncrypted: "encrypted-key",
    } as unknown as RecoveryFileContent;

    it("should return initial state", () => {
        const { result } = renderHook(
            () =>
                useRecoveryAvailability({
                    file: mockRecoveryFile,
                    newAuthenticatorId: "test-auth-id",
                }),
            { wrapper }
        );

        expect(result.current.recoveryAvailability).toBeUndefined();
        expect(result.current.isLoading).toBe(true);
    });

    it("should fetch recovery availability when file is provided", async () => {
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
            { wrapper }
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

    it("should not fetch when wallet address is missing", () => {
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
            { wrapper }
        );

        expect(result.current.recoveryAvailability).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
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
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBe(mockError);
    });
});
