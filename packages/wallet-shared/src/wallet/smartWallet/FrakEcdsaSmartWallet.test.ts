import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";

// Mock dependencies
vi.mock("@frak-labs/app-essentials", () => ({
    KernelWallet: {
        getFallbackWalletInitCode: vi.fn(),
    },
}));

vi.mock("./baseFrakWallet", () => ({
    baseFrakWallet: vi.fn(),
}));

describe("frakEcdsaWalletSmartAccount", () => {
    describe("smart account creation", () => {
        test("should create ECDSA smart account with correct parameters", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };
            const ecdsaAddress = createMockAddress("ecdsa");

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            const signatureProvider = vi.fn();

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress,
                signatureProvider,
            });

            expect(baseFrakWallet).toHaveBeenCalledWith(mockClient, {
                getSignature: signatureProvider,
                stubSignature:
                    "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
                generateInitCode: expect.any(Function),
                preDeterminedAccountAddress: undefined,
            });
        });

        test("should use fixed stub signature", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress: createMockAddress("ecdsa"),
                signatureProvider: vi.fn(),
            });

            const callArgs = vi.mocked(baseFrakWallet).mock.calls[0];
            expect(callArgs[1].stubSignature).toBe(
                "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
            );
        });

        test("should generate init code with ecdsa address", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };
            const ecdsaAddress = createMockAddress("ecdsa");

            let capturedGenerateInitCode: any;
            vi.mocked(baseFrakWallet).mockImplementation(
                async (_client, params) => {
                    capturedGenerateInitCode = params.generateInitCode;
                    return mockAccount as any;
                }
            );

            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress,
                signatureProvider: vi.fn(),
            });

            // Call the captured generateInitCode
            const initCode = capturedGenerateInitCode();

            expect(KernelWallet.getFallbackWalletInitCode).toHaveBeenCalledWith(
                {
                    ecdsaAddress,
                }
            );
            expect(initCode).toBe("0xinitcode");
        });

        test("should pass through preDeterminedAccountAddress", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };
            const preAddress = createMockAddress("predetermined");

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress: createMockAddress("ecdsa"),
                signatureProvider: vi.fn(),
                preDeterminedAccountAddress: preAddress,
            });

            expect(baseFrakWallet).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    preDeterminedAccountAddress: preAddress,
                })
            );
        });

        test("should return smart account from baseFrakWallet", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            const result = await frakEcdsaWalletSmartAccount(
                mockClient as any,
                {
                    ecdsaAddress: createMockAddress("ecdsa"),
                    signatureProvider: vi.fn(),
                }
            );

            expect(result).toBe(mockAccount);
        });
    });

    describe("signature provider integration", () => {
        test("should pass signature provider to baseFrakWallet", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            const signatureProvider = vi.fn().mockResolvedValue("0xsig" as Hex);

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress: createMockAddress("ecdsa"),
                signatureProvider,
            });

            const callArgs = vi.mocked(baseFrakWallet).mock.calls[0];
            // Verify a signature provider function was passed
            expect(callArgs[1].getSignature).toBeInstanceOf(Function);
        });

        test("should handle signature provider with hash argument", async () => {
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            let capturedSignatureProvider: any;
            vi.mocked(baseFrakWallet).mockImplementation(
                async (_client, params) => {
                    capturedSignatureProvider = params.getSignature;
                    return mockAccount as any;
                }
            );

            vi.mocked(KernelWallet.getFallbackWalletInitCode).mockReturnValue(
                "0xinitcode" as Hex
            );

            const signatureProvider = vi
                .fn()
                .mockResolvedValue("0xsignature" as Hex);

            await frakEcdsaWalletSmartAccount(mockClient as any, {
                ecdsaAddress: createMockAddress("ecdsa"),
                signatureProvider,
            });

            // Test calling the signature provider
            const hash = "0xhash" as Hex;
            const result = await capturedSignatureProvider({ hash });

            expect(signatureProvider).toHaveBeenCalledWith({ hash });
            expect(result).toBe("0xsignature");
        });
    });
});
