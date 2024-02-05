"use server";

import { setSession } from "@/context/session/actions/session";
import { formatWallet } from "@/context/wallet/formatter/walletFormatter";
import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import { getUserRepository } from "@/context/wallet/repository/UserRepository";
import { rpId, rpOrigin } from "@/context/wallet/smartWallet/webAuthN";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
    AuthenticationResponseJSON,
    PublicKeyCredentialDescriptorFuture,
} from "@simplewebauthn/types";
import { map } from "radash";

/**
 * Generate the webauthn authenticate options for a user
 * @param username
 */
export async function getAuthenticateOptions({
    username,
}: { username: string }) {
    const userRepository = await getUserRepository();
    const authenticatorRepository = await getAuthenticatorRepository();

    // Get or create the user
    const user = await userRepository.get({ username });
    if (!user) {
        throw new Error("No user found for this username");
    }
    // Get the current authenticators for the user
    const authenticators = await authenticatorRepository.getAllForUser(
        user._id
    );

    // Map them to a list of allowed credentials
    const allowCredentials: PublicKeyCredentialDescriptorFuture[] =
        authenticators.map(({ _id, transports }) => ({
            id: base64URLStringToBuffer(_id),
            type: "public-key",
            transports,
        }));

    // Generate the authentication options
    const options = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials,
        userVerification: "required",
    });

    // Add the challenge to the user
    await userRepository.addChallenge({
        userId: user._id,
        challenge: options.challenge,
    });

    // Return the options for signup
    return options;
}

/**
 * Validate a wallet authentication
 * @param registrationResponse
 */
export async function validateAuthentication({
    authenticationResponse,
}: {
    authenticationResponse: AuthenticationResponseJSON;
}) {
    const userRepository = await getUserRepository();
    const authenticatorRepository = await getAuthenticatorRepository();

    // Try to find the authenticator for this user
    const authenticator = await authenticatorRepository.getByCredentialId(
        authenticationResponse.id
    );
    if (!authenticator) {
        throw new Error("No authenticator found for this id");
    }

    const user = await userRepository.get({ _id: authenticator.userId });
    if (!user) {
        throw new Error("No user found for this authenticator");
    }

    // Throw error if not found
    if (!user.challenges) {
        throw new Error("No pending challenge found for user");
    }

    // Find a challenges in the user matching the one performed
    const verifications = await map(user.challenges, async (challenge) =>
        verifyAuthenticationResponse({
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
            expectedChallenge: challenge,
        })
    );
    const verification = verifications.find((v) => v.verified);
    if (!verification) {
        throw new Error("Authentication failed");
    }

    // Delete the challenge
    await userRepository.clearChallenges({ userId: user._id });

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
        username: user.username,
        wallet,
    });

    return wallet;
}
