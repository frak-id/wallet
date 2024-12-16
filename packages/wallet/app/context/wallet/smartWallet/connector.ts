import { currentChain } from "@/context/blockchain/provider";
import { getSmartAccountProvider } from "@/context/wallet/smartWallet/provider";
import type { SmartAccountV06 } from "@/context/wallet/smartWallet/utils";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import type { Wallet } from "@dynamic-labs/sdk-react-core";
import {
    type Account,
    type Address,
    type Chain,
    type Transport,
    type WalletClient,
    isAddressEqual,
} from "viem";
import { signMessage } from "viem/actions";
import { createConnector } from "wagmi";

smartAccountConnector.type = "frakSmartAccountConnector" as const;

export type FrakWalletConnector = ReturnType<
    ReturnType<typeof smartAccountConnector>
>;

/**
 * Create a connector for the smart account
 */
export function smartAccountConnector<
    transport extends Transport = Transport,
    account extends SmartAccountV06 = SmartAccountV06,
>() {
    // A few types shortcut
    type Provider = ReturnType<
        typeof getSmartAccountProvider<transport, account>
    >;

    // The current provider
    let provider: Provider | undefined;

    // The ecdsa message signer (null if not ready)
    let dynamicWallets: Wallet[] = [];
    let resolvedDynamicWalletClient:
        | WalletClient<Transport, Chain, Account>
        | undefined = undefined;

    async function getDynamicWalletClient(address: Address) {
        if (
            resolvedDynamicWalletClient &&
            isAddressEqual(resolvedDynamicWalletClient.account.address, address)
        ) {
            return resolvedDynamicWalletClient;
        }

        const matchingWallet = dynamicWallets.find((w) =>
            isAddressEqual(w.address as Address, address)
        );
        if (!(matchingWallet && isEthereumWallet(matchingWallet))) {
            throw new Error("Wallet not found");
        }

        resolvedDynamicWalletClient = await matchingWallet.getWalletClient();
        return resolvedDynamicWalletClient;
    }

    // Create the wagmi connector itself
    return createConnector<
        Provider,
        {
            onDynamicWalletUpdate: (args: Wallet[]) => void;
        }
    >((config) => ({
        id: "frak-wallet-connector",
        name: "Frak Smart Account",
        type: smartAccountConnector.type,
        supportsSimulation: true,

        /**
         * On setup, create the account for the first chain in the config
         */
        async setup() {
            await this.getProvider();
        },

        /**
         * Connect to the smart account
         * @param chainId
         */
        async connect({ chainId } = {}) {
            // Fetch the provider
            const provider: Provider = await this.getProvider();

            // If the chain id is not provided, use the current chain
            if (chainId && chainId !== currentChain.id) {
                throw new Error("Invalid chain id");
            }

            // If we got it in cache return it
            if (provider.currentSmartAccountClient) {
                return {
                    accounts: [
                        provider.currentSmartAccountClient.account.address,
                    ],
                    chainId: currentChain.id,
                };
            }

            // Ask the provider to build it
            const smartAccountClient = await provider.getSmartAccountClient();
            return {
                accounts: smartAccountClient
                    ? [smartAccountClient.account.address]
                    : [],
                chainId: currentChain.id,
            };
        },

        /**
         * Disconnect from the smart account, cleanup all the cached stuff
         */
        async disconnect() {
            (await this.getProvider()).disconnect();
        },

        /**
         * Fetch the current accounts
         */
        async getAccounts() {
            const provider: Provider = await this.getProvider();
            if (provider.currentSmartAccountClient) {
                return [provider.currentSmartAccountClient.account.address];
            }
            // Otherwise, get the account for the default chain (could be the case just after the login)
            const smartAccountClient = await provider.getSmartAccountClient();
            if (!smartAccountClient) {
                return [];
            }
            return [smartAccountClient.account.address];
        },

        /**
         * Get the current chain id (or otherwise the first one in the config)
         */
        async getChainId() {
            return currentChain.id;
        },
        async isAuthorized() {
            return true;
        },

        async getClient(parameters?: { chainId?: number }) {
            const provider: Provider = await this.getProvider();

            if (
                parameters?.chainId &&
                parameters?.chainId !== currentChain.id
            ) {
                throw new Error("Invalid chain id");
            }

            const client = await provider.getSmartAccountClient();
            if (!client) {
                throw new Error("No client found for the given chain");
            }
            return client;
        },

        async getProvider(): Promise<Provider> {
            if (!provider) {
                // Create the provider
                provider = getSmartAccountProvider({
                    onAccountChanged: (wallet) => {
                        console.log("Wagmi provider account changed", {
                            wallet,
                        });
                        // When the account change to no wallet, emit the disconnect event
                        if (!wallet) {
                            config.emitter.emit("change", {});
                            return;
                        }

                        // When the account change to a wallet, emit the connect event
                        config.emitter.emit("change", {
                            accounts: [wallet.address],
                            chainId: config.chains[0].id,
                        });
                    },

                    async signViaDynamic(message, address) {
                        const resolved = await getDynamicWalletClient(address);
                        if (!resolved) {
                            throw new Error("Dynamic not resolved");
                        }
                        // Sign the message
                        return await signMessage(resolved, {
                            message: { raw: message },
                        });
                    },
                });
            }
            return provider;
        },
        onAccountsChanged() {
            // Not relevant
        },
        onChainChanged() {
            // Not relevant
        },
        onDisconnect() {
            config.emitter.emit("disconnect");
        },

        onDynamicWalletUpdate(wallets: Wallet[]) {
            // Get all the wallet eth providers
            dynamicWallets = wallets;
        },
    }));
}
