/** @jsxImportSource react */
import type { WebAuthNWallet } from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useGenerateRecoveryOptions } from "./useGenerateRecoveryOptions";

vi.mock("viem/accounts", () => ({
    generatePrivateKey: vi.fn(
        () =>
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    ),
    privateKeyToAddress: vi.fn(
        () => "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91"
    ),
}));

vi.mock("@/module/recovery/action/generate", () => ({
    generateRecoveryData: vi.fn(),
}));

vi.mock("@/module/recovery-setup/utils/recoveryBlob", () => ({
    encodeRecoveryBlob: vi.fn(),
}));

describe("useGenerateRecoveryOptions", () => {
    const mockWallet: WebAuthNWallet = {
        address: "0x1234567890123456789012345678901234567890",
        authenticatorId: "auth-id-123",
        publicKey: { x: "0x1234", y: "0x5678" },
    };

    const mockPassword = "securePassword123";
    const validAfter = 1000;
    const validUntil = 2000;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.generateRecoveryOptions).toBeDefined();
        expect(result.current.generateRecoveryOptionsAsync).toBeDefined();
    });

    test("should return the setup tx data and the encrypted blob", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encodeRecoveryBlob } = await import(
            "@/module/recovery-setup/utils/recoveryBlob"
        );
        const { privateKeyToAddress } = await import("viem/accounts");

        const burnerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91";
        vi.mocked(privateKeyToAddress).mockReturnValue(burnerAddress as never);
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: burnerAddress,
            setupTxData: "0xsetuptxdata",
        });
        vi.mocked(encodeRecoveryBlob).mockResolvedValue("blob-string");

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.generateRecoveryOptionsAsync({
            wallet: mockWallet,
            password: mockPassword,
            validAfter,
            validUntil,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            setupTxData: "0xsetuptxdata",
            blob: "blob-string",
        });
        expect(generateRecoveryData).toHaveBeenCalledWith({
            guardianAddress: burnerAddress,
            validAfter,
            validUntil,
        });
    });

    test("should encrypt the burner key with the wallet address and password", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encodeRecoveryBlob } = await import(
            "@/module/recovery-setup/utils/recoveryBlob"
        );
        const { generatePrivateKey, privateKeyToAddress } = await import(
            "viem/accounts"
        );

        const burnerPrivateKey =
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        const burnerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91";

        vi.mocked(generatePrivateKey).mockReturnValue(burnerPrivateKey);
        vi.mocked(privateKeyToAddress).mockReturnValue(burnerAddress as never);
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: burnerAddress,
            setupTxData: "0xsetuptxdata",
        });
        vi.mocked(encodeRecoveryBlob).mockResolvedValue("encrypted-result");

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.generateRecoveryOptionsAsync({
            wallet: mockWallet,
            password: mockPassword,
            validAfter,
            validUntil,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(generatePrivateKey).toHaveBeenCalled();
        expect(encodeRecoveryBlob).toHaveBeenCalledWith({
            smartWalletAddress: mockWallet.address,
            burnerPrivateKey,
            password: mockPassword,
        });
    });

    test("should throw error on burner address mismatch", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { privateKeyToAddress } = await import("viem/accounts");

        vi.mocked(privateKeyToAddress).mockReturnValue(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91" as never
        );
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
            setupTxData: "0xsetuptxdata",
        });

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateRecoveryOptionsAsync({
                wallet: mockWallet,
                password: mockPassword,
                validAfter,
                validUntil,
            })
        ).rejects.toThrow("Burner address mismatch");
    });

    test("should handle recovery data generation failure", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );

        vi.mocked(generateRecoveryData).mockRejectedValue(
            new Error("Failed to generate recovery data")
        );

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateRecoveryOptionsAsync({
                wallet: mockWallet,
                password: mockPassword,
                validAfter,
                validUntil,
            })
        ).rejects.toThrow("Failed to generate recovery data");
    });

    test("should handle blob encryption failure", async ({ queryWrapper }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encodeRecoveryBlob } = await import(
            "@/module/recovery-setup/utils/recoveryBlob"
        );

        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91",
            setupTxData: "0xsetuptxdata",
        });
        vi.mocked(encodeRecoveryBlob).mockRejectedValue(
            new Error("Encryption failed")
        );

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateRecoveryOptionsAsync({
                wallet: mockWallet,
                password: mockPassword,
                validAfter,
                validUntil,
            })
        ).rejects.toThrow("Encryption failed");
    });
});
