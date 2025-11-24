import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";

// Mock dependencies
vi.mock("@frak-labs/app-essentials", () => ({
    KernelWallet: {
        getWebAuthNSmartWalletInitCode: vi.fn(),
    },
}));

vi.mock("../../pairing/clients/store", () => ({
    getOriginPairingClient: vi.fn(),
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

describe("frakPairedWalletSmartAccount", () => {
    describe("smart account creation", () => {
        test("should create paired WebAuthN smart account with correct parameters", async () => {
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            const mockPairingClient = {
                sendSignatureRequest: vi.fn(),
            };

            vi.mocked(getOriginPairingClient).mockReturnValue(
                mockPairingClient as any
            );
            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "paired-auth-id";
            const signerPubKey = {
                x: "0xpubkey-x" as Hex,
                y: "0xpubkey-y" as Hex,
            };

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey,
            });

            expect(baseFrakWallet).toHaveBeenCalledWith(mockClient, {
                stubSignature: "0xstub",
                getSignature: expect.any(Function),
                generateInitCode: expect.any(Function),
                preDeterminedAccountAddress: undefined,
            });
        });

        test("should use pairing client for signatures", async () => {
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            const mockSignature = "0xpaired-signature" as Hex;
            const mockPairingClient = {
                sendSignatureRequest: vi.fn().mockResolvedValue(mockSignature),
            };

            vi.mocked(getOriginPairingClient).mockReturnValue(
                mockPairingClient as any
            );

            let capturedSignatureProvider: any;
            vi.mocked(baseFrakWallet).mockImplementation(
                async (_client, params) => {
                    capturedSignatureProvider = params.getSignature;
                    return mockAccount as any;
                }
            );

            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId: "paired-id",
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
            });

            // Test the signature provider
            const hash = "0xhash-to-sign" as Hex;
            const result = await capturedSignatureProvider({ hash });

            expect(mockPairingClient.sendSignatureRequest).toHaveBeenCalledWith(
                hash
            );
            expect(result).toBe(mockSignature);
        });

        test("should hash authenticatorId for init code", async () => {
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");
            const { keccak256, toHex } = await import("viem");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(getOriginPairingClient).mockReturnValue({
                sendSignatureRequest: vi.fn(),
            } as any);
            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "paired-auth-id";

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
            });

            expect(toHex).toHaveBeenCalledWith(authenticatorId);
            expect(keccak256).toHaveBeenCalledWith(`0x${authenticatorId}`);
        });

        test("should generate init code with authenticatorIdHash and pubKey", async () => {
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(getOriginPairingClient).mockReturnValue({
                sendSignatureRequest: vi.fn(),
            } as any);

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

            const authenticatorId = "paired-auth-id";
            const signerPubKey = {
                x: "0xpubkey-x" as Hex,
                y: "0xpubkey-y" as Hex,
            };

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey,
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
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient, createMockAddress } = await import(
                "../../test/factories"
            );

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };
            const preAddress = createMockAddress("predetermined");

            vi.mocked(getOriginPairingClient).mockReturnValue({
                sendSignatureRequest: vi.fn(),
            } as any);
            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId: "paired-id",
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
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
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = { account: { address: "0xabc" as Address } };

            vi.mocked(getOriginPairingClient).mockReturnValue({
                sendSignatureRequest: vi.fn(),
            } as any);
            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const authenticatorId = "paired-auth-id";

            await frakPairedWalletSmartAccount(mockClient as any, {
                authenticatorId,
                signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
            });

            expect(getStubSignature).toHaveBeenCalledWith({
                authenticatorIdHash: `0xhashed-0x${authenticatorId}`,
            });
        });

        test("should return smart account from baseFrakWallet", async () => {
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { baseFrakWallet } = await import("./baseFrakWallet");
            const { getStubSignature } = await import("./webAuthN");
            const { KernelWallet } = await import("@frak-labs/app-essentials");
            const { getOriginPairingClient } = await import(
                "../../pairing/clients/store"
            );
            const { createMockClient } = await import("../../test/factories");

            const mockClient = createMockClient();
            const mockAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            vi.mocked(getOriginPairingClient).mockReturnValue({
                sendSignatureRequest: vi.fn(),
            } as any);
            vi.mocked(baseFrakWallet).mockResolvedValue(mockAccount as any);
            vi.mocked(getStubSignature).mockReturnValue("0xstub" as Hex);
            vi.mocked(
                KernelWallet.getWebAuthNSmartWalletInitCode
            ).mockReturnValue("0xinitcode" as Hex);

            const result = await frakPairedWalletSmartAccount(
                mockClient as any,
                {
                    authenticatorId: "paired-id",
                    signerPubKey: { x: "0xx" as Hex, y: "0xy" as Hex },
                }
            );

            expect(result).toBe(mockAccount);
        });
    });
});
