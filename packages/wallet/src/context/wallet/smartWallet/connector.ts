import type { SmartAccountClient } from "permissionless";
import type { SmartAccount } from "permissionless/accounts";
import type { EntryPoint } from "permissionless/types";
import { type Address, type Chain, type Transport, isAddressEqual } from "viem";
import { createConnector } from "wagmi";

/**
 * TODO: Should be dynamic, set during the wagmi config, and updated if the session is connected, sending the right events
 *  - Maybe smth like a top level connector linked to a few atoms
 *  - On this atom, react to the session changes and update the connector
 * @param smartAccountClientBuilder
 * @param id
 * @param name
 * @param type
 */
export function smartAccountConnector<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>({
    smartAccountClientBuilder,
    id,
    name,
    type = "smart-account",
}: {
    smartAccountClientBuilder: <chain extends chains[number]>(params: {
        chainId: chain["id"];
    }) => Promise<SmartAccountClient<entryPoint, transport, chain, account>>;
    id?: string;
    name?: string;
    type?: string;
}) {
    console.log("Creating smart account connector");

    // Cached smart accounts
    let smartAccounts: Record<
        number,
        | (SmartAccountClient<
              entryPoint,
              transport,
              chains[number],
              account
          > & {
              estimateGas?: () => undefined | bigint;
          })
        | undefined
    > = {};

    // The current smart account
    let currentSmartAccountClient:
        | (SmartAccountClient<
              entryPoint,
              transport,
              chains[number],
              account
          > & {
              estimateGas?: () => undefined | bigint;
          })
        | undefined;

    // The current computed address
    let currentComputedAddress: Address | undefined;

    // Get an account for the given chain
    const getSmartAccountClient = async (chainId: number) => {
        // Try to find it in cache, or build it
        let targetSmartAccount = smartAccounts[chainId];
        if (targetSmartAccount) {
            return targetSmartAccount;
        }

        // Otherwise, build it
        targetSmartAccount = await smartAccountClientBuilder({
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

    return createConnector((config) => ({
        id: id ?? `nexus-smart-account-${currentSmartAccountClient?.key}`,
        name: name ?? "Nexus Smart Account",
        type,

        /**
         * On setup, create the account for the first chain in the config
         */
        async setup() {
            console.log("Setting up smart account connector");
            const chainId = config.chains[0].id;
            currentSmartAccountClient = await smartAccountClientBuilder({
                chainId,
            });
            console.log("Smart account client setup", {
                chainId,
                currentSmartAccountClient,
            });

            // Emit the account changed event
            config.emitter.emit("change", {
                accounts: [currentSmartAccountClient.account.address],
                chainId,
            });
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

        async getProvider() {},
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
