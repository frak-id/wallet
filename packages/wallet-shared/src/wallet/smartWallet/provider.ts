import { smartAccountActions } from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import type { Address, Hex } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import {
    getPimlicoClient,
    getPimlicoTransport,
} from "../../blockchain/aa-provider";
import { currentChain, currentViemClient } from "../../blockchain/provider";
import { getSafeSession } from "../../common/utils/safeSession";
import { sessionStore } from "../../stores/sessionStore";
import type {
    DistantWebAuthnWallet,
    EcdsaWallet,
    Session,
} from "../../types/Session";
import type { WebAuthNWallet } from "../../types/WebAuthN";
import type { BaseFrakSmartAccount } from "./baseFrakWallet";
import { frakEcdsaWalletSmartAccount } from "./FrakEcdsaSmartWallet";
import { frakPairedWalletSmartAccount } from "./FrakPairedSmartWallet";
import { frakWalletSmartAccount } from "./FrakSmartWallet";
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

    const initialSession = getSafeSession();
    let currentWebAuthNWallet: Session | null = initialSession ?? null;

    // Subscribe to the session store, to refresh the wallet and emit a few stuff?
    sessionStore.subscribe((state) => {
        const signableWallet = state.session ?? null;

        // If the session hasn't changed, do nothing.
        // We compare authenticatorId AND address AND type: a wallet merge
        // can swap the bound wallet for an existing credential — same
        // authenticatorId, different address — and we MUST rebuild the
        // smart account + re-emit `change` for wagmi in that case.
        if (
            signableWallet?.authenticatorId ===
                currentWebAuthNWallet?.authenticatorId &&
            signableWallet?.address?.toLocaleLowerCase() ===
                currentWebAuthNWallet?.address?.toLocaleLowerCase() &&
            signableWallet?.type === currentWebAuthNWallet?.type
        ) {
            return;
        }
        // Otherwise, replace the session
        currentWebAuthNWallet = signableWallet;
        // Cleanup the cached stuff
        currentSmartAccountClient = undefined;
        // And tell that it has changed
        onAccountChanged(signableWallet ?? undefined);
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
 * Build a bundler client (smart account + Pimlico transport + paymaster)
 * for any concrete wallet shape. Used by the wagmi connector to wire the
 * live session, and by ad-hoc consumers (e.g. wallet-merge asset migration)
 * that need to sign as a wallet that is NOT the current wagmi session —
 * the loser smart wallet during a merge is the canonical example.
 *
 * `signViaEcdsa` is only required for `wallet.type === "ecdsa"`. Callers
 * that only ever pass webauthn / distant-webauthn wallets can omit it; the
 * builder throws at runtime if an ecdsa wallet is supplied without a signer.
 */
export async function buildSmartAccount({
    wallet,
    signViaEcdsa,
}: {
    wallet: WebAuthNWallet | EcdsaWallet | DistantWebAuthnWallet;
    signViaEcdsa?: (data: Hex, address: Address) => Promise<Hex>;
}) {
    let smartAccount: BaseFrakSmartAccount;
    if (wallet.type === "ecdsa") {
        if (!signViaEcdsa) {
            throw new Error(
                "buildSmartAccount: signViaEcdsa is required for ecdsa wallets"
            );
        }
        const ecdsaSigner = signViaEcdsa;
        // That's a ecdsa wallet
        smartAccount = await frakEcdsaWalletSmartAccount(currentViemClient, {
            ecdsaAddress: wallet.publicKey,
            preDeterminedAccountAddress: wallet.address,
            signatureProvider({ hash }) {
                return ecdsaSigner(hash, wallet.publicKey);
            },
        });
    } else if (wallet.type === "distant-webauthn") {
        // That's a distant webauthn wallet
        smartAccount = await frakPairedWalletSmartAccount(currentViemClient, {
            authenticatorId: wallet.authenticatorId,
            signerPubKey: wallet.publicKey,
            preDeterminedAccountAddress: wallet.address,
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
