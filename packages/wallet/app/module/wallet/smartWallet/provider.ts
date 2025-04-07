import {
    getPimlicoClient,
    getPimlicoTransport,
} from "@/module/blockchain/aa-provider";
import { currentChain, currentViemClient } from "@/module/blockchain/provider";
import { sessionAtom } from "@/module/common/atoms/session";
import { getSafeSession } from "@/module/listener/utils/localStorage";
import { frakEcdsaWalletSmartAccount } from "@/module/wallet/smartWallet/FrakEcdsaSmartWallet";
import { frakWalletSmartAccount } from "@/module/wallet/smartWallet/FrakSmartWallet";
import type { DistantWebAuthnWallet, EcdsaWallet } from "@/types/Session";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { jotaiStore } from "@shared/module/atoms/store";
import {
    type SmartAccountClient,
    createSmartAccountClient,
} from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import type { Address, Hex, Transport } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import { frakPairedWalletSmartAccount } from "./FrakPairedSmartWallet";
import type { BaseFrakSmartAccount } from "./baseFrakWallet";
import { signHashViaWebAuthN } from "./signature";

/**
 * Properties
 */
type SmartAccountProviderParameters = {
    /**
     * Method when the account has changed
     */
    onAccountChanged: (
        newWallet?: WebAuthNWallet | EcdsaWallet | DistantWebAuthnWallet
    ) => void;

    /**
     * Method used to sign a message via ecdsa
     * @param data
     * @param address
     */
    signViaEcdsa: (data: Hex, address: Address) => Promise<Hex>;
};

/**
 * Get the smart account provider for our wagmi connector
 */
export function getSmartAccountProvider<
    transport extends Transport = Transport,
    account extends BaseFrakSmartAccount = BaseFrakSmartAccount,
>({ onAccountChanged, signViaEcdsa }: SmartAccountProviderParameters) {
    console.log("Building a new smart account provider");
    // A few types shortcut
    type ConnectorClient = SmartAccountClient<
        transport,
        typeof currentChain,
        SmartAccount<account>
    > & {
        estimateGas?: () => undefined | bigint;
    };

    // The current smart account
    let currentSmartAccountClient: ConnectorClient | undefined;

    // The current session
    let currentWebAuthNWallet = getSafeSession();

    // Subscribe to the session atom, to refresh the wallet and emit a few stuff?
    jotaiStore.sub(sessionAtom, () => {
        const newWallet = getSafeSession();
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
                signViaEcdsa,
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
 * todo: need to handle distant webauthn
 * @param chainId
 * @param wallet
 */
async function buildSmartAccount<
    transport extends Transport = Transport,
    account extends BaseFrakSmartAccount = BaseFrakSmartAccount,
>({
    wallet,
    signViaEcdsa,
}: {
    wallet: WebAuthNWallet | EcdsaWallet | DistantWebAuthnWallet;
    signViaEcdsa: (data: Hex, address: Address) => Promise<Hex>;
}): Promise<
    SmartAccountClient<transport, typeof currentChain, SmartAccount<account>>
> {
    let smartAccount: BaseFrakSmartAccount;
    if (wallet.type === "ecdsa") {
        // That's a ecdsa wallet
        smartAccount = await frakEcdsaWalletSmartAccount(currentViemClient, {
            ecdsaAddress: wallet.publicKey,
            preDeterminedAccountAddress: wallet.address,
            signatureProvider({ hash }) {
                return signViaEcdsa(hash, wallet.publicKey);
            },
        });
    } else if (wallet.type === "distant-webauthn") {
        // That's a distant webauthn wallet
        smartAccount = await frakPairedWalletSmartAccount(currentViemClient, {
            authenticatorId: wallet.authenticatorId,
            signerPubKey: wallet.publicKey,
        });
    } else {
        // That's a webauthn wallet
        smartAccount = await frakWalletSmartAccount(currentViemClient, {
            authenticatorId: wallet.authenticatorId,
            signerPubKey: wallet.publicKey,
            signatureProvider: async ({ hash }) =>
                signHashViaWebAuthN({
                    hash,
                    wallet,
                }),
            preDeterminedAccountAddress: wallet.address,
        });
    }

    // Get the bundler and paymaster clients
    const pimlicoTransport = getPimlicoTransport();
    const pimlicoClient = getPimlicoClient();

    // Build the smart wallet client
    return createSmartAccountClient({
        account: smartAccount,
        chain: currentChain,
        bundlerTransport: pimlicoTransport,
        // Get the right gas fees for the user operation
        userOperation: {
            estimateFeesPerGas: async () => {
                const { standard } =
                    await getUserOperationGasPrice(pimlicoClient);
                return standard;
            },
        },
        // Get the right paymaster datas
        paymaster: true,
    }) as SmartAccountClient<
        transport,
        typeof currentChain,
        SmartAccount<account>
    >;
}
