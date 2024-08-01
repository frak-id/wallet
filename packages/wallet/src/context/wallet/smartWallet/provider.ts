import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import {
    type AvailableChainIds,
    availableChains,
    frakChainPocClient,
} from "@/context/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import { nexusSmartAccount } from "@/context/wallet/smartWallet/NexusSmartWallet";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { sessionAtom } from "@/module/common/atoms/session";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { getViemClientFromChain } from "@frak-labs/shared/context/blockchain/provider";
import { jotaiStore } from "@module/atoms/store";
import { startAuthentication } from "@simplewebauthn/browser";
import {
    ENTRYPOINT_ADDRESS_V06,
    type SmartAccountClient,
    createSmartAccountClient,
} from "permissionless";
import type { SmartAccount } from "permissionless/accounts";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import type { EntryPoint } from "permissionless/types";
import { tryit } from "radash";
import { type Chain, type Transport, extractChain } from "viem";
import { estimateGas } from "viem/actions";

/**
 * Get the current authenticated wallet
 */
const getAuthenticatedWallet = () => {
    // If non SSR, direct return
    if (typeof window === "undefined") return undefined;
    // Return the session atom
    return jotaiStore.get(sessionAtom)?.wallet;
};

/**
 * Properties
 */
type SmartAccountProvierParameters = {
    /**
     * Method when the account has changed
     */
    onAccountChanged: (newWallet?: WebAuthNWallet) => void;
};

/**
 * Get the smart account provider for our wagmi connector
 */
export function getSmartAccountProvider<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>({ onAccountChanged }: SmartAccountProvierParameters) {
    console.log("Building a new smart account provider");
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

    // The current session
    let currentWebAuthNWallet = getAuthenticatedWallet();

    // Subscribe to the session atom, to refresh the wallet and emit a few stuff?
    jotaiStore.sub(sessionAtom, () => {
        const newWallet = getAuthenticatedWallet();
        // If the session hasn't changed, do nothing
        if (
            newWallet?.authenticatorId ===
            currentWebAuthNWallet?.authenticatorId
        ) {
            return;
        }
        // Otherwise, replace the session
        currentWebAuthNWallet = newWallet;
        // Cleanup the cached stuff
        smartAccounts = {};
        currentSmartAccountClient = undefined;
        // And tell that it has changed
        onAccountChanged(newWallet);
    });

    return {
        /**
         * Check if the user is authorized
         */
        isAuthorized: () => !!currentWebAuthNWallet,

        /**
         * Access the current smart account
         */
        currentSmartAccountClient,

        /**
         * Get the smart account client for the given chain
         */
        getSmartAccountClient: async (chainId: number) => {
            // Try to find it in cache
            let targetSmartAccount = smartAccounts[chainId];
            if (targetSmartAccount) {
                return targetSmartAccount;
            }

            // If not found, and no current wallet, return undefined
            if (!currentWebAuthNWallet) {
                return undefined;
            }

            // Otherwise, build it
            targetSmartAccount = await buildSmartAccount({
                chainId,
                wallet: currentWebAuthNWallet,
            });

            // Save the new one
            smartAccounts[chainId] = targetSmartAccount;
            currentSmartAccountClient = targetSmartAccount;

            // Return the built client
            return targetSmartAccount;
        },

        /**
         * On disconnect, cleanup the cached stuff
         */
        disconnect: async () => {
            // Cleanup the cached stuff
            smartAccounts = {};
            currentSmartAccountClient = undefined;
        },
    };
}

/**
 * Build the smart account client on the given chain id
 * @param chainId
 * @param wallet
 */
async function buildSmartAccount<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccount<entryPoint> = SmartAccount<entryPoint>,
>({
    chainId,
    wallet,
}: { chainId: number; wallet: WebAuthNWallet }): Promise<
    SmartAccountClient<entryPoint, transport, chains[number], account> & {
        estimateGas?: () => undefined | bigint;
    }
> {
    type Client = SmartAccountClient<
        entryPoint,
        transport,
        chains[number],
        account
    > & {
        estimateGas?: () => undefined | bigint;
    };

    // Get the viem client
    const chain = extractChain({
        chains: availableChains,
        id: chainId as AvailableChainIds,
    });
    if (!chain) {
        throw new Error(`Chain with id ${chainId} not configured`);
    }
    const viemClient = getViemClientFromChain({ chain });

    // Get the smart wallet client
    const smartAccount = await nexusSmartAccount(viemClient, {
        authenticatorId: wallet.authenticatorId,
        signerPubKey: wallet.publicKey,
        signatureProvider: async (message) => {
            // Get the signature options from server
            const options = await getSignOptions({
                authenticatorId: wallet.authenticatorId,
                toSign: message,
            });

            // Start the client authentication
            const authenticationResponse = await startAuthentication(options);

            // Perform the verification of the signature
            return parseWebAuthNAuthentication(authenticationResponse);
        },
        preDeterminedAccountAddress: wallet.address,
    });

    // Get the bundler and paymaster clients
    const { bundlerTransport } = getBundlerClient(viemClient.chain);
    const paymasterClient = getPaymasterClient(viemClient.chain);

    // Build the smart wallet client
    const client = createSmartAccountClient({
        account: smartAccount,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        chain: viemClient.chain,
        bundlerTransport,
        // Only add a middleware if the paymaster client is available
        middleware: {
            sponsorUserOperation: async (args) => {
                // Perform a direct gas estimation of the call and update the user op
                const [, estimation] = await tryit(() =>
                    estimateGas(frakChainPocClient, {
                        account: args.userOperation.sender,
                        to: args.userOperation.sender,
                        data: args.userOperation.callData,
                    })
                )();
                if (!estimation) {
                    return sponsorUserOperation(paymasterClient, args);
                }
                // Use the estimation with 25% of error margin on the estimation
                args.userOperation.callGasLimit = (estimation * 125n) / 100n;

                // Send the sponsoring request
                return sponsorUserOperation(paymasterClient, args);
            },
        },
    }) as unknown as Client;

    // Override the estimate gas method
    // https://github.com/wevm/wagmi/blob/main/packages/core/src/actions/sendTransaction.ts#L77
    client.estimateGas = () => {
        return undefined;
    };

    return client;
}
