import { currentChain } from "@/context/blockchain/provider";
import { getSmartAccountProvider } from "@/context/wallet/smartWallet/provider";
import type { SmartAccount } from "permissionless/accounts";
import type { EntryPoint } from "permissionless/types";
import type { Chain, Transport } from "viem";
import { createConnector } from "wagmi";

smartAccountConnector.type = "nexusSmartAccountConnector" as const;

/**
 * Create a connector for the smart account
 */
export function smartAccountConnector<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>() {
    // A few types shortcut
    type Provider = ReturnType<
        typeof getSmartAccountProvider<entryPoint, transport, chains, account>
    >;

    // The current provider
    let provider: Provider | undefined;

    // Create the wagmi connector itself
    return createConnector<Provider>((config) => ({
        id: "nexus-connector",
        name: "Nexus Smart Account",
        type: smartAccountConnector.type,

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
        // @ts-ignore: Permissionless account type is fcked up for now (missing a few required props)
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
                });
            }
            return provider;
        },
        onAccountsChanged() {
            // Not relevant
        },
        onChainChanged() {
            // Not relevant -> TODO: But are we sure about that?
        },
        onDisconnect() {
            config.emitter.emit("disconnect");
        },
    }));
}
