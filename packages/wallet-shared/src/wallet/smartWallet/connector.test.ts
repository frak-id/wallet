import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import type { SmartAccountProviderType } from "./provider";

// Mock dependencies
vi.mock("wagmi", () => ({
    createConnector: vi.fn((fn) => fn),
}));

vi.mock("../../blockchain/provider", () => ({
    currentChain: { id: 1 },
}));

vi.mock("./provider", () => ({
    getSmartAccountProvider: vi.fn(),
}));

describe("smartAccountConnector", () => {
    describe("connector initialization", () => {
        test("should create connector with correct type", async () => {
            const { smartAccountConnector } = await import("./connector");

            expect(smartAccountConnector.type).toBe(
                "frakSmartAccountConnector"
            );
        });

        test("should create connector with correct properties", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: {
                    emit: vi.fn(),
                },
            } as any;

            const instance = connector(config);

            expect(instance.id).toBe("frak-wallet-connector");
            expect(instance.name).toBe("Frak Smart Account");
            expect(instance.type).toBe("frakSmartAccountConnector");
            expect(instance.supportsSimulation).toBe(true);
        });
    });

    describe("setup", () => {
        test("should call getProvider on setup", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: {
                    emit: vi.fn(),
                },
            } as any;

            const instance = connector(config);
            const getProviderSpy = vi.spyOn(instance, "getProvider");

            await instance.setup();

            expect(getProviderSpy).toHaveBeenCalled();
        });
    });

    describe("connect", () => {
        test("should connect with cached smart account client", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockSmartAccountClient = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: mockSmartAccountClient as any,
                getSmartAccountClient: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const result = await instance.connect();

            expect(result.accounts).toEqual([
                "0x1234567890123456789012345678901234567890",
            ]);
            expect(result.chainId).toBe(1);
        });

        test("should connect with capabilities when requested", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockAddress =
                "0x1234567890123456789012345678901234567890" as Address;
            const mockSmartAccountClient = {
                account: { address: mockAddress },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: mockSmartAccountClient as any,
                getSmartAccountClient: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const result = await instance.connect({ withCapabilities: true });

            expect(result.accounts).toEqual([
                { address: mockAddress, capabilities: {} },
            ]);
        });

        test("should build smart account client when not cached", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockAddress =
                "0x1234567890123456789012345678901234567890" as Address;
            const mockSmartAccountClient = {
                account: { address: mockAddress },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi
                    .fn()
                    .mockResolvedValue(mockSmartAccountClient),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const result = await instance.connect();

            expect(mockProvider.getSmartAccountClient).toHaveBeenCalled();
            expect(result.accounts).toEqual([mockAddress]);
        });

        test("should throw error on invalid chain id", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);

            await expect(
                instance.connect({ chainId: 999 })
            ).rejects.toThrowError("Invalid chain id");
        });
    });

    describe("disconnect", () => {
        test("should call provider disconnect", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const disconnectMock = vi.fn();
            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn(),
                disconnect: disconnectMock,
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            await instance.disconnect();

            expect(disconnectMock).toHaveBeenCalled();
        });
    });

    describe("getAccounts", () => {
        test("should return cached account address", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockAddress =
                "0x1234567890123456789012345678901234567890" as Address;
            const mockSmartAccountClient = {
                account: { address: mockAddress },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: mockSmartAccountClient as any,
                getSmartAccountClient: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const accounts = await instance.getAccounts();

            expect(accounts).toEqual([mockAddress]);
        });

        test("should fetch account when not cached", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockAddress =
                "0xabcdef1234567890abcdef1234567890abcdef12" as Address;
            const mockSmartAccountClient = {
                account: { address: mockAddress },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi
                    .fn()
                    .mockResolvedValue(mockSmartAccountClient),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const accounts = await instance.getAccounts();

            expect(mockProvider.getSmartAccountClient).toHaveBeenCalled();
            expect(accounts).toEqual([mockAddress]);
        });

        test("should return empty array when no smart account client", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn().mockResolvedValue(undefined),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const accounts = await instance.getAccounts();

            expect(accounts).toEqual([]);
        });
    });

    describe("getChainId", () => {
        test("should return current chain id", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const chainId = await instance.getChainId();

            expect(chainId).toBe(1);
        });
    });

    describe("isAuthorized", () => {
        test("should always return true", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const isAuthorized = await instance.isAuthorized();

            expect(isAuthorized).toBe(true);
        });
    });

    describe("getClient", () => {
        test("should return smart account client", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockClient = {
                account: {
                    address:
                        "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn().mockResolvedValue(mockClient),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const client = await instance.getClient();

            expect(client).toEqual(mockClient);
        });

        test("should throw error when no client found", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn().mockResolvedValue(undefined),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);

            await expect(instance.getClient()).rejects.toThrowError(
                "No client found for the given chain"
            );
        });

        test("should throw error on invalid chain id", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            const mockProvider: SmartAccountProviderType = {
                isAuthorized: () => true,
                currentSmartAccountClient: undefined,
                getSmartAccountClient: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.mocked(getSmartAccountProvider).mockReturnValue(mockProvider);

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);

            await expect(
                instance.getClient({ chainId: 999 })
            ).rejects.toThrowError("Invalid chain id");
        });
    });

    describe("setEcdsaSigner", () => {
        test("should update ecdsa signer", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            const mockSigner = vi.fn();

            // Should not throw
            instance.setEcdsaSigner(mockSigner);
        });

        test("should throw error when ecdsa signer not set", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            let signViaEcdsa: any;
            vi.mocked(getSmartAccountProvider).mockImplementation((params) => {
                signViaEcdsa = params.signViaEcdsa;
                return {
                    isAuthorized: () => true,
                    currentSmartAccountClient: undefined,
                    getSmartAccountClient: vi.fn(),
                    disconnect: vi.fn(),
                };
            });

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            await instance.getProvider();

            await expect(
                signViaEcdsa("0xhash" as Hex, "0xaddress" as Address)
            ).rejects.toThrowError("No privy signer");
        });

        test("should use ecdsa signer when set", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            let signViaEcdsa: any;
            vi.mocked(getSmartAccountProvider).mockImplementation((params) => {
                signViaEcdsa = params.signViaEcdsa;
                return {
                    isAuthorized: () => true,
                    currentSmartAccountClient: undefined,
                    getSmartAccountClient: vi.fn(),
                    disconnect: vi.fn(),
                };
            });

            const connector = smartAccountConnector();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: vi.fn() },
            } as any;

            const instance = connector(config);
            await instance.getProvider();

            const mockSignature = "0xsignature" as Hex;
            const mockSigner = vi.fn().mockResolvedValue(mockSignature);
            instance.setEcdsaSigner(mockSigner);

            const result = await signViaEcdsa(
                "0xhash" as Hex,
                "0xaddress" as Address
            );

            expect(mockSigner).toHaveBeenCalledWith({
                hash: "0xhash",
                address: "0xaddress",
            });
            expect(result).toBe(mockSignature);
        });
    });

    describe("account change handling", () => {
        test("should emit change event when account changes to wallet", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            let onAccountChanged: any;
            vi.mocked(getSmartAccountProvider).mockImplementation((params) => {
                onAccountChanged = params.onAccountChanged;
                return {
                    isAuthorized: () => true,
                    currentSmartAccountClient: undefined,
                    getSmartAccountClient: vi.fn(),
                    disconnect: vi.fn(),
                };
            });

            const connector = smartAccountConnector();
            const emitMock = vi.fn();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: emitMock },
            } as any;

            const instance = connector(config);
            await instance.getProvider();

            const mockWallet = {
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
            };

            onAccountChanged(mockWallet);

            expect(emitMock).toHaveBeenCalledWith("change", {
                accounts: [mockWallet.address],
                chainId: 1,
            });
        });

        test("should emit change event when account changes to undefined", async () => {
            const { smartAccountConnector } = await import("./connector");
            const { getSmartAccountProvider } = await import("./provider");

            let onAccountChanged: any;
            vi.mocked(getSmartAccountProvider).mockImplementation((params) => {
                onAccountChanged = params.onAccountChanged;
                return {
                    isAuthorized: () => true,
                    currentSmartAccountClient: undefined,
                    getSmartAccountClient: vi.fn(),
                    disconnect: vi.fn(),
                };
            });

            const connector = smartAccountConnector();
            const emitMock = vi.fn();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: emitMock },
            } as any;

            const instance = connector(config);
            await instance.getProvider();

            onAccountChanged(undefined);

            expect(emitMock).toHaveBeenCalledWith("change", {});
        });
    });

    describe("disconnect handling", () => {
        test("should emit disconnect event", async () => {
            const { smartAccountConnector } = await import("./connector");

            const connector = smartAccountConnector();
            const emitMock = vi.fn();
            const config = {
                chains: [{ id: 1 }],
                emitter: { emit: emitMock },
            } as any;

            const instance = connector(config);
            instance.onDisconnect();

            expect(emitMock).toHaveBeenCalledWith("disconnect");
        });
    });
});
