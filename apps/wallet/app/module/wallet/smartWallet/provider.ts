import {
    currentChain,
    currentViemClient,
} from "@frak-labs/wallet-shared/blockchain/provider";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import type {
    DistantWebAuthnWallet,
    EcdsaWallet,
} from "@frak-labs/wallet-shared/types/Session";
import type { WebAuthNWallet } from "@frak-labs/wallet-shared/types/WebAuthN";
import { smartAccountActions } from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import type { Address, Hex } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import {
    getPimlicoClient,
    getPimlicoTransport,
} from "@/module/blockchain/aa-provider";
import { frakEcdsaWalletSmartAccount } from "@/module/wallet/smartWallet/FrakEcdsaSmartWallet";
import { frakWalletSmartAccount } from "@/module/wallet/smartWallet/FrakSmartWallet";
import type { BaseFrakSmartAccount } from "./baseFrakWallet";
import { frakPairedWalletSmartAccount } from "./FrakPairedSmartWallet";
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
export function getSmartAccountProvider({
    onAccountChanged,
    signViaEcdsa,
}: SmartAccountProviderParameters): SmartAccountProviderType {
    console.log("Building a new smart account provider");

    // The current smart account
    let currentSmartAccountClient: SmartAccountConnectorClient | undefined;

    // The current session
    let currentWebAuthNWallet = getSafeSession();

    // Subscribe to the session store, to refresh the wallet and emit a few stuff?
    sessionStore.subscribe((state) => {
        const newWallet = state.session;
        // If the session hasn't changed, do nothing
        if (
            newWallet?.authenticatorId ===
            currentWebAuthNWallet?.authenticatorId
        ) {
            return;
        }
        // Otherwise, replace the session
        currentWebAuthNWallet = newWallet ?? null;
        // Cleanup the cached stuff
        currentSmartAccountClient = undefined;
        // And tell that it has changed
        onAccountChanged(newWallet ?? undefined);
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
 * @param chainId
 * @param wallet
 */
async function buildSmartAccount({
    wallet,
    signViaEcdsa,
}: {
    wallet: WebAuthNWallet | EcdsaWallet | DistantWebAuthnWallet;
    signViaEcdsa: (data: Hex, address: Address) => Promise<Hex>;
}) {
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
    return createBundlerClient({
        account: smartAccount,
        chain: currentChain,
        transport: pimlicoTransport,
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
    }).extend(smartAccountActions);
}

/**
 * Exported types for connector usage
 */
export type SmartAccountConnectorClient = Awaited<
    ReturnType<typeof buildSmartAccount>
> & {
    estimateGas?: () => undefined | bigint;
};

export type SmartAccountProviderType = {
    isAuthorized: () => boolean;
    currentSmartAccountClient: SmartAccountConnectorClient | undefined;
    getSmartAccountClient: () => Promise<
        SmartAccountConnectorClient | undefined
    >;
    disconnect: () => Promise<void>;
};
