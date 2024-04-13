import type { SmartAccountClient } from "permissionless";
import type { SmartAccount } from "permissionless/accounts";
import type { EntryPoint } from "permissionless/types";
import { type Chain, type Transport, isAddressEqual } from "viem";
import { createConnector } from "wagmi";

export type SmartAccountBuilder<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
> = <chain extends chains[number]>(params: {
    chainId: chain["id"];
}) => Promise<SmartAccountClient<entryPoint, transport, chain, account>>;

smartAccountConnector.type = "nexusSmartAccountConnector" as const;

/**
 * Create a connector for the smart account
 * @param accountBuilder
 */
export function smartAccountConnector<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>({
    accountBuilder,
}: {
    accountBuilder: SmartAccountBuilder<entryPoint, transport, chains, account>;
}) {
    // A few types shortcut
    type ConnectorClient = SmartAccountClient<
        entryPoint,
        transport,
        chains[number],
        account
    > & {
        estimateGas?: () => undefined | bigint;
    };

    // Cached smart accounts
    let smartAccounts: Record<number, ConnectorClient | undefined> = {};

    // The current smart account
    let currentSmartAccountClient: ConnectorClient | undefined;

    // Get an account for the given chain
    const getSmartAccountClient = async (chainId: number) => {
        // Try to find it in cache, or build it
        let targetSmartAccount = smartAccounts[chainId];
        if (targetSmartAccount) {
            return targetSmartAccount;
        }

        // Otherwise, build it
        targetSmartAccount = await accountBuilder({
            chainId,
        });

        // Check if the address match
        if (
            currentSmartAccountClient?.account &&
            !isAddressEqual(
                currentSmartAccountClient?.account.address,
                targetSmartAccount.account.address
            )
        ) {
            throw new Error(
                "The computed address doesn't match the smart account address"
            );
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
    return createConnector((config) => ({
        id: "nexus-connector",
        name: "Nexus Smart Account",
        type: smartAccountConnector.type,

        /**
         * On setup, create the account for the first chain in the config
         */
        async setup() {
            console.log("Setting up the connector");
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
            console.log("Disconnecting the connector");
            currentSmartAccountClient = undefined;
            smartAccounts = {};
        },

        /**
         * Fetch the current accounts
         */
        async getAccounts() {
            console.log("Getting accounts");
            if (!currentSmartAccountClient) {
                return [];
            }
            return [currentSmartAccountClient.account.address];
        },

        /**
         * Get the current chain id (or otherwise the first one in the config)
         */
        async getChainId() {
            console.log("Getting current chain");
            return currentSmartAccountClient?.chain?.id ?? config.chains[0].id;
        },

        async getProvider() {},
        async isAuthorized() {
            console.log("Checking authorisation");
            return !!currentSmartAccountClient?.account?.address;
        },
        async getClient({ chainId }: { chainId: number }) {
            console.log("Getting client for given chain", {
                chainId,
                currentSmartAccountClient,
                smartAccounts,
            });
            const client = getSmartAccountClient(chainId);
            if (!client) {
                throw new Error("No client found for the given chain");
            }
            return client;
        },
        onAccountsChanged() {
            // Not relevant
            console.log("On account changed");
        },
        onChainChanged() {
            console.log("Chain changed");
        },
        onDisconnect() {
            console.log("On disconnect");
            config.emitter.emit("disconnect");
        },
    }));
}
