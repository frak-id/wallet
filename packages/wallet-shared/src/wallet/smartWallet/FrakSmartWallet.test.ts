import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";

// Mock dependencies
vi.mock("@frak-labs/app-essentials", () => ({
    KernelWallet: {
        getWebAuthNSmartWalletInitCode: vi.fn(),
    },
}));

vi.mock("./baseFrakWallet", () => ({
    baseFrakWallet: vi.fn(),
}));

vi.mock("./webAuthN", () => ({
    getStubSignature: vi.fn(),
}));

vi.mock("viem", async () => {
    const actual = await vi.importActual<any>("viem");
    return {
        ...actual,
        keccak256: vi.fn((value) => `0xhashed-${value}` as Hex),
        toHex: vi.fn((value) => `0x${value}` as Hex),
    };
});

describe("frakWalletSmartAccount", () => {
    describe("smart account creation", () => {
        test("should create WebAuthN smart account with correct parameters", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "test-auth-id";
            const signerPubKey = {
                x: "0xpubkey-x" as Hex,
                y: "0xpubkey-y" as Hex,
            };
            const signatureProvider = vi.fn();

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey,
                signatureProvider,
            });

            expect(baseFrakWallet).toHaveBeenCalledWith(mockClient, {
                stubSignature: "0xstub",
                getSignature: signatureProvider,
                generateInitCode: expect.any(Function),
                preDeterminedAccountAddress: undefined,
            });
        });

        test("should hash authenticatorId for init code generation", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");
            const { keccak256, toHex } = await import("viem");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "test-auth-id";
            const signerPubKey = {
                x: "0xpubkey-x" as Hex,
                y: "0xpubkey-y" as Hex,
            };

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey,
                signatureProvider: vi.fn(),
            });

            expect(toHex).toHaveBeenCalledWith(authenticatorId);
            expect(keccak256).toHaveBeenCalledWith(`0x${authenticatorId}`);
        });

        test("should generate init code with authenticatorIdHash and pubKey", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            let capturedGenerateInitCode: any;
            vi.mocked(baseFrakWallet).mockImplementation(
                async (_client, params) => {
                    capturedGenerateInitCode = params.generateInitCode;
                    return mockAccount as any;
                }
            );

            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "test-auth-id";
            const signerPubKey = {
                x: "0xpubkey-x" as Hex,
                y: "0xpubkey-y" as Hex,
            };

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey,
                signatureProvider: vi.fn(),
            });

            // Call the captured generateInitCode
            const initCode = capturedGenerateInitCode();

            expect(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).toHaveBeenCalledWith({
                authenticatorIdHash: `0xhashed-0x${authenticatorId}`,
                signerPubKey,
            });
            expect(initCode).toBe("0xinitcode");
        });

        test("should pass through preDeterminedAccountAddress", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };
            const preAddress = createMockAddress("predetermined");

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId: "test-id",
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
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

        test("should get stub signature with authenticatorIdHash", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "test-auth-id";

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
                signatureProvider: vi.fn(),
            });

            expect(getStubSignature).toHaveBeenCalledWith({
                authenticatorIdHash: `0xhashed-0x${authenticatorId}`,
            });
        });

        test("should return smart account from baseFrakWallet", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const result = await frakWalletSmartAccount(mockClient as any, {
                authenticatorId: "test-id",
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
                signatureProvider: vi.fn(),
            });

            expect(result).toBe(mockAccount);
        });
    });

    describe("signature provider integration", () => {
        test("should pass signature provider to baseFrakWallet", async () => {
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const signatureProvider = vi.fn().mockResolvedValue("0xsig" as Hex);

            await frakWalletSmartAccount(mockClient as any, {
                authenticatorId: "test-id",
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
                signatureProvider,
            });

            const callArgs = vi.mocked(baseFrakWallet).mock.calls[0];
            // Verify a signature provider function was passed
            expect(callArgs[1].getSignature).toBeInstanceOf(Function);
        });
    });
});
