import { currentChain } from "@/module/blockchain/provider";
import { getSmartAccountProvider } from "@/module/wallet/smartWallet/provider";
import type { Address, Hex, Transport } from "viem";
import { createConnector } from "wagmi";

smartAccountConnector.type = "frakSmartAccountConnector" as const;

export type FrakWalletConnector = ReturnType<
    ReturnType<typeof smartAccountConnector>
>;

/**
 * Create a connector for the smart account
 */
export function smartAccountConnector<
    transport extends Transport = Transport
>() {
    // A few types shortcut
    type Provider = ReturnType<
        typeof getSmartAccountProvider<transport>
    >;

    // The current provider
    let provider: Provider | undefined;

    // The current ecdsa signer
    let ecdsaSigner:
        | ((args: { hash: Hex; address: Address }) => Promise<Hex>)
        | undefined = undefined;

    // Create the wagmi connector itself
    return createConnector<
        Provider,
        {
            setEcdsaSigner: (signer: typeof ecdsaSigner) => void;
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

                    async signViaEcdsa(message, address) {
                        if (!ecdsaSigner) {
                            throw new Error("No privy signer");
                        }

                        return ecdsaSigner({ hash: message, address });
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
        /**
         * Update the current ecdsa signer
         * @param signer
         */
        setEcdsaSigner(signer: typeof ecdsaSigner) {
            ecdsaSigner = signer;
        },
    }));
}
