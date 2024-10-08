"use server";
import { setSession } from "@/context/session/action/session";
import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import { rpId, rpOrigin } from "@/context/wallet/smartWallet/webAuthN";
import { formatWallet } from "@/context/wallet/utils/walletFormatter";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

/**
 * Validate a wallet authentication
 * @param expectedChallenge
 * @param authenticationResponse
 */
export async function validateAuthentication({
    expectedChallenge,
    authenticationResponse,
}: {
    expectedChallenge: string;
    authenticationResponse: AuthenticationResponseJSON;
}) {
    const authenticatorRepository = await getAuthenticatorRepository();

    // Try to find the authenticator for this user
    const authenticator = await authenticatorRepository.getByCredentialId(
        authenticationResponse.id
    );
    if (!authenticator) {
        throw new Error("No authenticator found for this id");
    }

    // Find a challenges in the user matching the one performed
    const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedOrigin: rpOrigin,
        expectedRPID: rpId,
        authenticator: {
            counter: authenticator.counter,
            credentialID: authenticator._id,
            credentialPublicKey: new Uint8Array(
                base64URLStringToBuffer(authenticator.credentialPublicKey)
            ),
        },
        expectedChallenge,
    });

    // Update this authenticator counter (if the counter has changed, not the case with touch id)
    if (verification.authenticationInfo.newCounter !== authenticator.counter) {
        await authenticatorRepository.updateCounter({
            credentialId: authenticator._id,
            counter: verification.authenticationInfo.newCounter + 1,
        });
    }

    // Format the wallet
    const wallet = await formatWallet({
        authenticatorId: authenticator._id,
        publicKey: authenticator.publicKey,
        previousWallet: authenticator.smartWalletAddress,
    });

    // If the wallet didn't have any predicated smart wallet address, set it
    if (authenticator.smartWalletAddress === undefined) {
        await authenticatorRepository.updateSmartWalletAddress({
            credentialId: authenticator._id,
            smartWalletAddress: wallet.address,
        });
    }

    // Add it to the session
    await setSession({
        wallet,
    });

    return {
        wallet,
    };
}
