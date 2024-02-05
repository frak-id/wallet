import { viemClient } from "@/context/common/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import { webAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import type { P256PubKey } from "@/types/WebAuthN";
import { startAuthentication } from "@simplewebauthn/browser";

/**
 * Helper to ease the build of a webauthn smart wallet
 * @param authenticatorId
 * @param publicKey
 */
export async function buildSmartWallet({
    authenticatorId,
    publicKey,
}: { authenticatorId: string; publicKey: P256PubKey }) {
    if (!(authenticatorId && publicKey)) return;

    // Build the user smart wallet
    // @ts-ignore
    return await webAuthNSmartAccount(viemClient, {
        signerPubKey: publicKey,
        signatureProvider: async (message) => {
            // Get the signature options from server
            const options = await getSignOptions({
                authenticatorId,
                toSign: message,
            });

            // Start the client authentication
            const authenticationResponse = await startAuthentication(options);

            // Perform the verification of the signature
            return parseWebAuthNAuthentication(authenticationResponse);
        },
    });
}
