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

vi.mock("@/module/recovery-setup/utils/encrypt", () => ({
    encryptPrivateKey: vi.fn(),
}));

describe("useGenerateRecoveryOptions", () => {
    const mockWallet: WebAuthNWallet = {
        address: "0x1234567890123456789012345678901234567890",
        authenticatorId: "auth-id-123",
        publicKey: { x: "0x1234", y: "0x5678" },
    };

    const mockPass = "securePassword123";

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

    test("should generate recovery options successfully", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encryptPrivateKey } = await import(
            "@/module/recovery-setup/utils/encrypt"
        );
        const { privateKeyToAddress } = await import("viem/accounts");

        const burnerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91";
        vi.mocked(privateKeyToAddress).mockReturnValue(burnerAddress as any);
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: burnerAddress,
            setupTxData: "0xsetuptxdata",
        } as any);
        vi.mocked(encryptPrivateKey).mockResolvedValue("encrypted-key-base64");

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.generateRecoveryOptionsAsync({
            wallet: mockWallet,
            pass: mockPass,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            setupTxData: "0xsetuptxdata",
            file: {
                initialWallet: mockWallet,
                guardianAddress: burnerAddress,
                guardianPrivateKeyEncrypted: "encrypted-key-base64",
            },
        });
    });

    test("should generate new burner wallet each time", async ({
        queryWrapper,
    }) => {
        const { generatePrivateKey } = await import("viem/accounts");
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encryptPrivateKey } = await import(
            "@/module/recovery-setup/utils/encrypt"
        );

        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91",
            setupTxData: "0xsetuptxdata",
        } as any);
        vi.mocked(encryptPrivateKey).mockResolvedValue("encrypted-key");

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.generateRecoveryOptionsAsync({
            wallet: mockWallet,
            pass: mockPass,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(generatePrivateKey).toHaveBeenCalled();
    });

    test("should throw error on burner address mismatch", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { privateKeyToAddress } = await import("viem/accounts");

        vi.mocked(privateKeyToAddress).mockReturnValue(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91" as any
        );
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
            setupTxData: "0xsetuptxdata",
        } as any);

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateRecoveryOptionsAsync({
                wallet: mockWallet,
                pass: mockPass,
            })
        ).rejects.toThrow("Burner address mismatch");
    });

    test("should encrypt private key with wallet address and password", async ({
        queryWrapper,
    }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encryptPrivateKey } = await import(
            "@/module/recovery-setup/utils/encrypt"
        );
        const { generatePrivateKey, privateKeyToAddress } = await import(
            "viem/accounts"
        );

        const burnerPrivateKey =
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        const burnerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91";

        vi.mocked(generatePrivateKey).mockReturnValue(burnerPrivateKey);
        vi.mocked(privateKeyToAddress).mockReturnValue(burnerAddress as any);
        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: burnerAddress,
            setupTxData: "0xsetuptxdata",
        } as any);
        vi.mocked(encryptPrivateKey).mockResolvedValue("encrypted-result");

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.generateRecoveryOptionsAsync({
            wallet: mockWallet,
            pass: mockPass,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(encryptPrivateKey).toHaveBeenCalledWith({
            privateKey: burnerPrivateKey,
            initialAddress: mockWallet.address,
            pass: mockPass,
        });
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
                pass: mockPass,
            })
        ).rejects.toThrow("Failed to generate recovery data");
    });

    test("should handle encryption failure", async ({ queryWrapper }) => {
        const { generateRecoveryData } = await import(
            "@/module/recovery/action/generate"
        );
        const { encryptPrivateKey } = await import(
            "@/module/recovery-setup/utils/encrypt"
        );

        vi.mocked(generateRecoveryData).mockResolvedValue({
            guardianAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f5bE91",
            setupTxData: "0xsetuptxdata",
        } as any);
        vi.mocked(encryptPrivateKey).mockRejectedValue(
            new Error("Encryption failed")
        );

        const { result } = renderHook(() => useGenerateRecoveryOptions(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.generateRecoveryOptionsAsync({
                wallet: mockWallet,
                pass: mockPass,
            })
        ).rejects.toThrow("Encryption failed");
    });
});
