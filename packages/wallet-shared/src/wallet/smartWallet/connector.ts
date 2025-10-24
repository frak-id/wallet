import type { Address, Hex } from "viem";
import { type CreateConnectorFn, createConnector } from "wagmi";
import { currentChain } from "../../blockchain/provider";
import {
    getSmartAccountProvider,
    type SmartAccountProviderType,
} from "./provider";

smartAccountConnector.type = "frakSmartAccountConnector" as const;

export type FrakWalletConnector = ReturnType<FrakWalletConnectorFn>;
export type FrakWalletConnectorFn = CreateConnectorFn<
    SmartAccountProviderType,
    {
        setEcdsaSigner: (
            signer: (args: { hash: Hex; address: Address }) => Promise<Hex>
        ) => void;
    }
>;

/**
 * Create a connector for the smart account
 */
export function smartAccountConnector() {
    // The current provider
    let cachedProvider: SmartAccountProviderType | undefined;

    // The current ecdsa signer
    let ecdsaSigner:
        | ((args: { hash: Hex; address: Address }) => Promise<Hex>)
        | undefined;

    // Create the wagmi connector itself
    return createConnector((config) => ({
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
         * biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Waiting for wagmi v3 to have standard type
         */
        async connect({ chainId, withCapabilities } = {}) {
            // Fetch the provider
            const provider = await this.getProvider();

            // If the chain id is not provided, use the current chain
            if (chainId && chainId !== currentChain.id) {
                throw new Error("Invalid chain id");
            }

            // If we got it in cache return it
            if (provider.currentSmartAccountClient) {
                const address =
                    provider.currentSmartAccountClient.account.address;
                return {
                    accounts: address
                        ? withCapabilities
                            ? [{ address, capabilities: {} }]
                            : [address]
                        : [],
                    chainId: currentChain.id,
                    // biome-ignore lint/suspicious/noExplicitAny: Waiting for wagmi v3 to have standard type
                } as any;
            }

            // Ask the provider to build it
            const smartAccountClient = await provider.getSmartAccountClient();
            const address = smartAccountClient?.account.address;
            return {
                accounts: address
                    ? withCapabilities
                        ? [{ address, capabilities: {} }]
                        : [address]
                    : [],
                chainId: currentChain.id,
                // biome-ignore lint/suspicious/noExplicitAny: Waiting for wagmi v3 to have standard type
            } as any;
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
            const provider = await this.getProvider();
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
            const provider = await this.getProvider();

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

        async getProvider(): Promise<SmartAccountProviderType> {
            if (!cachedProvider) {
                // Create the provider
                cachedProvider = getSmartAccountProvider({
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
            return cachedProvider;
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
    })) satisfies FrakWalletConnectorFn;
}
