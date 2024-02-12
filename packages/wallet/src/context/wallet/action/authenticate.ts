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
 * @param username
 * @param expectedChallenge
 * @param authenticationResponse
 */
export async function validateAuthentication({
    expectedChallenge,
    authenticationResponse,
}: {
    username?: string;
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
            credentialID: new Uint8Array(
                base64URLStringToBuffer(authenticator._id)
            ),
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
    });

    // Add it to the session
    await setSession({
        username: authenticator.username,
        wallet,
    });

    return {
        username: authenticator.username,
        wallet,
    };
}
