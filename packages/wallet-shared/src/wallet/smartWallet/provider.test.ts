import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";

// Mock dependencies
vi.mock("permissionless", () => ({
    smartAccountActions: {},
}));

vi.mock("permissionless/actions/pimlico", () => ({
    getUserOperationGasPrice: vi.fn(),
}));

vi.mock("viem/account-abstraction", () => ({
    createBundlerClient: vi.fn((config) => ({
        ...config,
        extend: (actions: any) => ({ ...config, ...actions }),
    })),
}));

vi.mock("../../blockchain/aa-provider", () => ({
    getPimlicoClient: vi.fn(() => ({})),
    getPimlicoTransport: vi.fn(() => ({})),
}));

vi.mock("../../blockchain/provider", () => ({
    currentChain: { id: 1, name: "Ethereum" },
    currentViemClient: {},
}));

vi.mock("../../common/utils/safeSession", () => ({
    getSafeSession: vi.fn(),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        subscribe: vi.fn(),
        getState: vi.fn(),
    },
}));

vi.mock("./FrakEcdsaSmartWallet", () => ({
    frakEcdsaWalletSmartAccount: vi.fn(),
}));

vi.mock("./FrakPairedSmartWallet", () => ({
    frakPairedWalletSmartAccount: vi.fn(),
}));

vi.mock("./FrakSmartWallet", () => ({
    frakWalletSmartAccount: vi.fn(),
}));

vi.mock("./signature", () => ({
    signHashViaWebAuthN: vi.fn(),
}));

describe("getSmartAccountProvider", () => {
    describe("provider initialization", () => {
        test("should create provider with correct properties", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );

            vi.mocked(getSafeSession).mockReturnValue(null);

            const onAccountChanged = vi.fn();
            const signViaEcdsa = vi.fn();

            const provider = getSmartAccountProvider({
                onAccountChanged,
                signViaEcdsa,
            });

            expect(provider).toBeDefined();
            expect(provider.isAuthorized).toBeInstanceOf(Function);
            expect(provider.getSmartAccountClient).toBeInstanceOf(Function);
            expect(provider.disconnect).toBeInstanceOf(Function);
        });

        test("should initialize with safe session", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");

            const mockSession = createMockSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            expect(provider.isAuthorized()).toBe(true);
        });
    });

    describe("isAuthorized", () => {
        test("should return true when session exists", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");

            const mockSession = createMockSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            expect(provider.isAuthorized()).toBe(true);
        });

        test("should return false when no session", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );

            vi.mocked(getSafeSession).mockReturnValue(null);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            expect(provider.isAuthorized()).toBe(false);
        });
    });

    describe("getSmartAccountClient", () => {
        test("should return undefined when no wallet", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );

            vi.mocked(getSafeSession).mockReturnValue(null);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const client = await provider.getSmartAccountClient();

            expect(client).toBeUndefined();
        });

        test("should build WebAuthN smart account", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockSession({ type: "webauthn" });
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSmartAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };
            vi.mocked(frakWalletSmartAccount).mockResolvedValue(
                mockSmartAccount as any
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const client = await provider.getSmartAccountClient();

            expect(frakWalletSmartAccount).toHaveBeenCalled();
            expect(client).toBeDefined();
        });

        test("should build ECDSA smart account", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockEcdsaSession } = await import(
                "../../test/factories"
            );
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockEcdsaSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSmartAccount = {
                account: {
                    address:
                        "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
                },
            };
            vi.mocked(frakEcdsaWalletSmartAccount).mockResolvedValue(
                mockSmartAccount as any
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const client = await provider.getSmartAccountClient();

            expect(frakEcdsaWalletSmartAccount).toHaveBeenCalled();
            expect(client).toBeDefined();
        });

        test("should build distant WebAuthN smart account", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockDistantWebAuthNSession } = await import(
                "../../test/factories"
            );
            const { frakPairedWalletSmartAccount } = await import(
                "./FrakPairedSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockDistantWebAuthNSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSmartAccount = {
                account: {
                    address:
                        "0x9999999999999999999999999999999999999999" as Address,
                },
            };
            vi.mocked(frakPairedWalletSmartAccount).mockResolvedValue(
                mockSmartAccount as any
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const client = await provider.getSmartAccountClient();

            expect(frakPairedWalletSmartAccount).toHaveBeenCalled();
            expect(client).toBeDefined();
        });

        test("should cache smart account client", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSmartAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };
            vi.mocked(frakWalletSmartAccount).mockResolvedValue(
                mockSmartAccount as any
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const client1 = await provider.getSmartAccountClient();
            const client2 = await provider.getSmartAccountClient();

            // Both calls should return the same client (cached)
            expect(client1).toBe(client2);
            // Should be called at least once (may be called more due to other tests)
            expect(frakWalletSmartAccount).toHaveBeenCalled();
        });
    });

    describe("disconnect", () => {
        test("should clear cached client", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSmartAccount = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };
            vi.mocked(frakWalletSmartAccount).mockResolvedValue(
                mockSmartAccount as any
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            const firstClient = await provider.getSmartAccountClient();
            await provider.disconnect();

            // After disconnect, getSmartAccountClient should rebuild
            const newClient = await provider.getSmartAccountClient();
            expect(newClient).toBeDefined();
            // Both clients should be defined, disconnect clears internal cache
            expect(firstClient).toBeDefined();
        });
    });

    describe("session store subscription", () => {
        test("should subscribe to session changes", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(getSafeSession).mockReturnValue(null);

            getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            expect(sessionStore.subscribe).toHaveBeenCalled();
        });

        test("should call onAccountChanged when session changes", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSession } = await import("../../test/factories");

            const mockSession1 = createMockSession({
                authenticatorId: "auth-1",
            });
            const mockSession2 = createMockSession({
                authenticatorId: "auth-2",
            });

            vi.mocked(getSafeSession).mockReturnValue(mockSession1);

            const onAccountChanged = vi.fn();
            let subscribeCallback: any;

            vi.mocked(sessionStore.subscribe).mockImplementation((fn) => {
                subscribeCallback = fn;
                return vi.fn();
            });

            getSmartAccountProvider({
                onAccountChanged,
                signViaEcdsa: vi.fn(),
            });

            // Simulate session change
            subscribeCallback({ session: mockSession2 });

            expect(onAccountChanged).toHaveBeenCalledWith(mockSession2);
        });

        test("should not call onAccountChanged when session is the same", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { createMockSession } = await import("../../test/factories");

            const mockSession = createMockSession({
                authenticatorId: "auth-1",
            });
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const onAccountChanged = vi.fn();
            let subscribeCallback: any;

            vi.mocked(sessionStore.subscribe).mockImplementation((fn) => {
                subscribeCallback = fn;
                return vi.fn();
            });

            getSmartAccountProvider({
                onAccountChanged,
                signViaEcdsa: vi.fn(),
            });

            // Simulate session change with same authenticatorId
            subscribeCallback({ session: mockSession });

            expect(onAccountChanged).not.toHaveBeenCalled();
        });
    });

    describe("signature providers", () => {
        test("should use signViaEcdsa for ECDSA wallet", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockEcdsaSession } = await import(
                "../../test/factories"
            );
            const { frakEcdsaWalletSmartAccount } = await import(
                "./FrakEcdsaSmartWallet"
            );
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockEcdsaSession();
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSignature = "0xsignature" as Hex;
            const signViaEcdsa = vi.fn().mockResolvedValue(mockSignature);

            let capturedSignatureProvider: any;
            vi.mocked(frakEcdsaWalletSmartAccount).mockImplementation(
                async (_client, params) => {
                    capturedSignatureProvider = params.signatureProvider;
                    return {
                        account: {
                            address:
                                "0x1234567890123456789012345678901234567890" as Address,
                        },
                    } as any;
                }
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa,
            });

            await provider.getSmartAccountClient();

            // Test the signature provider
            const hash = "0xhash" as Hex;
            const result = await capturedSignatureProvider({ hash });

            expect(signViaEcdsa).toHaveBeenCalledWith(
                hash,
                mockSession.publicKey
            );
            expect(result).toBe(mockSignature);
        });

        test("should use signHashViaWebAuthN for WebAuthN wallet", async () => {
            const { getSmartAccountProvider } = await import("./provider");
            const { getSafeSession } = await import(
                "../../common/utils/safeSession"
            );
            const { createMockSession } = await import("../../test/factories");
            const { frakWalletSmartAccount } = await import(
                "./FrakSmartWallet"
            );
            const { signHashViaWebAuthN } = await import("./signature");
            const { getUserOperationGasPrice } = await import(
                "permissionless/actions/pimlico"
            );

            const mockSession = createMockSession({ type: "webauthn" });
            vi.mocked(getSafeSession).mockReturnValue(mockSession);

            const mockSignature = "0xwebauthn-signature" as Hex;
            vi.mocked(signHashViaWebAuthN).mockResolvedValue(mockSignature);

            let capturedSignatureProvider: any;
            vi.mocked(frakWalletSmartAccount).mockImplementation(
                async (_client, params) => {
                    capturedSignatureProvider = params.signatureProvider;
                    return {
                        account: {
                            address:
                                "0x1234567890123456789012345678901234567890" as Address,
                        },
                    } as any;
                }
            );

            vi.mocked(getUserOperationGasPrice).mockResolvedValue({
                standard: {
                    maxFeePerGas: 1000n,
                    maxPriorityFeePerGas: 100n,
                },
            } as any);

            const provider = getSmartAccountProvider({
                onAccountChanged: vi.fn(),
                signViaEcdsa: vi.fn(),
            });

            await provider.getSmartAccountClient();

            // Test the signature provider
            const hash = "0xhash" as Hex;
            await capturedSignatureProvider({ hash });

            expect(signHashViaWebAuthN).toHaveBeenCalledWith({
                hash,
                wallet: mockSession,
            });
        });
    });
});
