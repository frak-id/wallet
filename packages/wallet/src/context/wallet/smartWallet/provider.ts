import {
    getPimlicoClient,
    getPimlicoTransport,
} from "@/context/blockchain/aa-provider";
import { currentChain, currentViemClient } from "@/context/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import { nexusSmartAccount } from "@/context/wallet/smartWallet/NexusSmartWallet";
import type { SmartAccountV06 } from "@/context/wallet/smartWallet/utils";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { sessionAtom } from "@/module/common/atoms/session";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { jotaiStore } from "@module/atoms/store";
import { startAuthentication } from "@simplewebauthn/browser";
import {
    type SmartAccountClient,
    createSmartAccountClient,
} from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import { tryit } from "radash";
import type { Chain, Transport } from "viem";
import { paymasterActions } from "viem/account-abstraction";
import type { SmartAccount } from "viem/account-abstraction";
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
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccountV06 = SmartAccountV06,
>({ onAccountChanged }: SmartAccountProvierParameters) {
    console.log("Building a new smart account provider");
    // A few types shortcut
    type ConnectorClient = SmartAccountClient<
        transport,
        chains[number],
        SmartAccount<account>
    > & {
        estimateGas?: () => undefined | bigint;
    };

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
        getSmartAccountClient: async () => {
            // Try to find it in cache
            let targetSmartAccount = currentSmartAccountClient;
            if (targetSmartAccount) {
                return targetSmartAccount;
            }

            // If not found, and no current wallet, return undefined
            if (!currentWebAuthNWallet) {
                return undefined;
            }

            // Otherwise, build it
            targetSmartAccount = await buildSmartAccount({
                wallet: currentWebAuthNWallet,
            });

            // Save the new one
            currentSmartAccountClient = targetSmartAccount;

            // Return the built client
            return targetSmartAccount;
        },

        /**
         * On disconnect, cleanup the cached stuff
         */
        disconnect: async () => {
            // Cleanup the cached stuff
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
    transport extends Transport = Transport,
    chains extends readonly Chain[] = Chain[],
    account extends SmartAccountV06 = SmartAccountV06,
>({
    wallet,
}: { wallet: WebAuthNWallet }): Promise<
    SmartAccountClient<transport, chains[number], SmartAccount<account>> & {
        estimateGas?: () => undefined | bigint;
    }
> {
    type Client = SmartAccountClient<
        transport,
        chains[number],
        SmartAccount<account>
    > & {
        estimateGas?: () => undefined | bigint;
    };

    // Get the smart wallet client
    const smartAccount = await nexusSmartAccount(currentViemClient, {
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
    const pimlicoTransport = getPimlicoTransport();
    const pimlicoClient = getPimlicoClient();
    const pmActions = paymasterActions(pimlicoClient);

    // Build the smart wallet client
    const client = createSmartAccountClient({
        account: smartAccount,
        chain: currentChain,
        bundlerTransport: pimlicoTransport,
        // Get the right gas fees for the user operation
        userOperation: {
            estimateFeesPerGas: async () => {
                // Get gas price + direct estimation in //
                const { standard } =
                    await getUserOperationGasPrice(pimlicoClient);
                return standard;
            },
        },
        // Get the right paymaster datas
        paymaster: {
            getPaymasterData: async (userOperation) => {
                const [, estimation] = await tryit(() =>
                    estimateGas(currentViemClient, {
                        account: userOperation.sender,
                        to: userOperation.sender,
                        data: userOperation.callData,
                    })
                )();
                if (!estimation) {
                    return pmActions.getPaymasterData(userOperation);
                }
                // Use the estimation with 25% of error margin on the estimation
                userOperation.callGasLimit = (estimation * 125n) / 100n;
                return pmActions.getPaymasterData(userOperation);
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
