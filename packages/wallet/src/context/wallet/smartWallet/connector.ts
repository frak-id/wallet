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

            if (!chainId && provider.currentSmartAccountClient) {
                return {
                    accounts: [
                        provider.currentSmartAccountClient.account.address,
                    ],
                    chainId: provider.currentSmartAccountClient.chain.id,
                };
            }

            const safeChainId = chainId ?? config.chains[0].id;
            if (!safeChainId) {
                throw new Error(
                    "chainId is required to connect to a smart account"
                );
            }

            // Ask the provider to build it
            const smartAccountClient =
                await provider.getSmartAccountClient(safeChainId);
            return {
                accounts: smartAccountClient
                    ? [smartAccountClient.account.address]
                    : [],
                chainId: safeChainId,
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
            if (!provider.currentSmartAccountClient) {
                return [];
            }
            return [provider.currentSmartAccountClient.account.address];
        },

        /**
         * Get the current chain id (or otherwise the first one in the config)
         */
        async getChainId() {
            const provider: Provider = await this.getProvider();
            return (
                provider.currentSmartAccountClient?.chain?.id ??
                config.chains[0].id
            );
        },
        async isAuthorized() {
            return true;
        },
        async getClient({ chainId }: { chainId: number }) {
            const provider: Provider = await this.getProvider();
            const client = await provider.getSmartAccountClient(chainId);
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
