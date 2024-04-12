import type { Emitter } from "@wagmi/core/internal";
import type { SmartAccountClient } from "permissionless";
import type { SmartAccount } from "permissionless/accounts";
import type { EntryPoint } from "permissionless/types";
import { type Address, type Chain, type Transport, isAddressEqual } from "viem";
import { type ConnectorEventMap, createConnector } from "wagmi";

export type SmartAccountBuilder<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
> = <chain extends chains[number]>(params: {
    chainId: chain["id"];
}) => Promise<SmartAccountClient<entryPoint, transport, chain, account>>;

/**
 * Provider for the smart account
 */
export type SmartAccountProvider<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
> = {
    onBuilderChange: (
        builder?: SmartAccountBuilder<entryPoint, transport, chains, account>
    ) => Promise<void>;
};

/**
 * TODO: Should be dynamic, set during the wagmi config, and updated if the session is connected, sending the right events
 *  - Maybe smth like a top level connector linked to a few atoms
 *  - On this atom, react to the session changes and update the connector
 * @param initialAccountBuilder
 */
export function smartAccountConnector<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>({
    initialAccountBuilder,
}: {
    initialAccountBuilder?: SmartAccountBuilder<
        entryPoint,
        transport,
        chains,
        account
    >;
}) {
    // A few types shortcut
    type Provider = SmartAccountProvider<
        entryPoint,
        transport,
        chains,
        account
    >;
    type Builder = SmartAccountBuilder<entryPoint, transport, chains, account>;
    type ConnectorClient = SmartAccountClient<
        entryPoint,
        transport,
        chains[number],
        account
    > & {
        estimateGas?: () => undefined | bigint;
    };

    // The current builder
    let currentBuilder: Builder | undefined = undefined;

    // Cached smart accounts
    let smartAccounts: Record<number, ConnectorClient | undefined> = {};

    // The current smart account
    let currentSmartAccountClient: ConnectorClient | undefined;

    // The current computed address
    let currentComputedAddress: Address | undefined;

    // Provider builder function
    let provider: Provider | undefined = undefined;
    const createProvider = async (
        config: {
            chains: readonly [Chain, ...Chain[]];
            emitter: Emitter<ConnectorEventMap>;
        },
        params?: { chainId?: number }
    ): Promise<Provider> => ({
        onBuilderChange: async (builder) => {
            // Cleanup cached account
            currentComputedAddress = undefined;
            currentSmartAccountClient = undefined;
            smartAccounts = {};

            // Set the new builder
            currentBuilder = builder;

            // If current builder is null, emit disconnect
            if (!currentBuilder) {
                config.emitter.emit("disconnect");
                return;
            }

            // Otherwise, setup the new account
            const chainId = params?.chainId ?? config.chains[0].id;
            currentSmartAccountClient = await getSmartAccountClient(chainId);

            // Build the event data and emit connection event
            const eventData = {
                accounts: [currentSmartAccountClient.account.address],
                chainId,
            };

            // Emit the connection event
            config.emitter.emit("connect", eventData);
        },
    });

    // Get an account for the given chain
    const getSmartAccountClient = async (chainId: number) => {
        // Try to find it in cache, or build it
        let targetSmartAccount = smartAccounts[chainId];
        if (targetSmartAccount) {
            return targetSmartAccount;
        }

        // Otherwise, check if we got a builder
        if (!currentBuilder) {
            throw new Error("No smart account builder available");
        }

        // Otherwise, build it
        targetSmartAccount = await currentBuilder({
            chainId,
        });

        // Check if the address match
        if (
            currentComputedAddress &&
            !isAddressEqual(
                currentComputedAddress,
                targetSmartAccount.account.address
            )
        ) {
            throw new Error(
                "The computed address doesn't match the smart account address"
            );
        }

        // If we don't have any computed address yet, set it
        if (!currentComputedAddress) {
            currentComputedAddress = targetSmartAccount.account.address;
        }

        // Don't remove this, it is needed because wagmi has an opinion on always estimating gas:
        // https://github.com/wevm/wagmi/blob/main/packages/core/src/actions/sendTransaction.ts#L77
        targetSmartAccount.estimateGas = () => {
            return undefined;
        };

        smartAccounts[chainId] = targetSmartAccount;

        return targetSmartAccount;
    };

    // Create the wagmi connector itself
    return createConnector<Provider>((config) => ({
        id: `nexus-connector`,
        name: "Nexus Smart Account",
        type: "nexus-connector",

        /**
         * On setup, create the account for the first chain in the config
         */
        async setup() {
            // Create the provider
            const provider = await this.getProvider();
            await provider.onBuilderChange(initialAccountBuilder);
        },

        /**
         * Connect to the smart account
         * @param chainId
         */
        async connect({ chainId } = {}) {
            console.log("Connecting the connector", {
                chainId,
                currentSmartAccountClient,
                smartAccounts,
            });
            if (!chainId && currentSmartAccountClient) {
                return {
                    accounts: [currentSmartAccountClient.account.address],
                    chainId: currentSmartAccountClient.chain.id,
                };
            }

            const safeChainId = chainId ?? config.chains[0].id;
            if (!safeChainId) {
                throw new Error(
                    "chainId is required to connect to a smart account"
                );
            }

            // Try to find  it in cache, or build it
            const smartAccountClient = await getSmartAccountClient(safeChainId);
            currentSmartAccountClient = smartAccountClient;

            return {
                accounts: [smartAccountClient.account.address],
                chainId: safeChainId,
            };
        },

        /**
         * Disconnect from the smart account, cleanup all the cached stuff
         */
        async disconnect() {
            currentSmartAccountClient = undefined;
            smartAccounts = {};
        },

        /**
         * Fetch the current accounts
         */
        async getAccounts() {
            if (!currentSmartAccountClient) {
                return [];
            }
            return [currentSmartAccountClient.account.address];
        },

        /**
         * Get the current chain id (or otherwise the first one in the config)
         */
        async getChainId() {
            return currentSmartAccountClient?.chain?.id ?? config.chains[0].id;
        },

        async getProvider(params): Promise<Provider> {
            if (!provider) {
                provider = await createProvider(config, params);
            }
            return provider;
        },
        async isAuthorized() {
            return !!currentSmartAccountClient?.account?.address;
        },
        async getClient({ chainId }: { chainId: number }) {
            console.log("Getting client for given chain", {
                chainId,
                currentSmartAccountClient,
                smartAccounts,
            });
            return getSmartAccountClient(chainId);
        },
        onAccountsChanged() {
            // Not relevant
        },
        onChainChanged() {
            // Not relevant because smart accounts only exist on single chain.
        },
        onDisconnect() {
            config.emitter.emit("disconnect");
        },
    }));
}
