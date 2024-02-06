"use server";

import { setSession } from "@/context/session/action/session";
import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import { getUserRepository } from "@/context/wallet/repository/UserRepository";
import {
    decodePublicKey,
    rpId,
    rpName,
    rpOrigin,
} from "@/context/wallet/smartWallet/webAuthN";
import { formatWallet } from "@/context/wallet/utils/walletFormatter";
import {
    base64URLStringToBuffer,
    bufferToBase64URLString,
} from "@simplewebauthn/browser";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { map, tryit } from "radash";
import {
    adjectives,
    nouns,
    uniqueUsernameGenerator,
} from "unique-username-generator";

/**
 * Generate a new username
 */
export async function getUsername(): Promise<string> {
    // Generate a new username
    const username = uniqueUsernameGenerator({
        dictionaries: [nouns, adjectives],
        separator: "-",
        randomDigits: 0,
        length: 20,
        style: "lowerCase",
    });

    // Check if it's available
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
        // If not, try again
        return getUsername();
    }

    return username;
}

/**
 * Check if a username is available
 * @param username
 */
export async function isUsernameAvailable(username: string) {
    const userRepository = await getUserRepository();
    return userRepository.isUsernameAvailable(username);
}

/**
 * Generate the webauthn registration options for a user
 * @param username
 */
export async function getRegisterOptions({ username }: { username: string }) {
    const userRepository = await getUserRepository();
    const authenticatorRepository = await getAuthenticatorRepository();

    // Get or create the user
    const user = await userRepository.getOrCreate(username);
    // Get the current authenticators for the user
    const authenticators = await authenticatorRepository.getAllForUser(
        user._id
    );

    // Generate the registration options
    const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: user._id.toHexString(),
        userName: username,
        userDisplayName: username,
        timeout: 120_000,
        attestationType: "direct",
        authenticatorSelection: {
            requireResidentKey: true,
            // authenticatorAttachment: "platform", TODO: With that we can specify mobile / desktop / or neither
            userVerification: "required",
        },
        supportedAlgorithmIDs: [-7],
        excludeCredentials: authenticators.map(({ _id, transports }) => ({
            id: base64URLStringToBuffer(_id),
            type: "public-key",
            transports,
        })),
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
 * Validate a new wallet registration
 * @param username
 * @param registrationResponse
 * @param userAgent
 */
export async function validateRegistration({
    username,
    registrationResponse,
    userAgent,
}: {
    username: string;
    registrationResponse: RegistrationResponseJSON;
    userAgent: string;
}) {
    const userRepository = await getUserRepository();
    const authenticatorRepository = await getAuthenticatorRepository();

    const user = await userRepository.get({ username });
    if (!user) {
        throw new Error("No user found for this username");
    }

    // Throw error if not found
    if (!user.challenges) {
        throw new Error("No challenge found for user");
    }

    // Find a challenges in the user matching the one performed
    const verifications = await map(user.challenges, async (challenge) => {
        // Encapsulated inside a try it since it can throw error if invalid challenge
        const [, result] = await tryit(async () =>
            verifyRegistrationResponse({
                response: registrationResponse,
                expectedChallenge: challenge,
                expectedOrigin: rpOrigin,
                expectedRPID: rpId,
            })
        )();
        return result;
    });
    const verification = verifications.find((v) => v?.verified === true);
    if (!verification?.registrationInfo) {
        throw new Error("Registration failed");
    }

    // Delete the challenge
    await userRepository.clearChallenges({ userId: user._id });

    // Get the public key
    const publicKey = decodePublicKey({
        credentialPubKey: verification.registrationInfo.credentialPublicKey,
    });

    // Extract the info we want to store
    const {
        credentialPublicKey,
        credentialID,
        counter,
        credentialDeviceType,
        credentialBackedUp,
    } = verification.registrationInfo;

    // Create the authenticator for this user
    const id = bufferToBase64URLString(credentialID);
    await authenticatorRepository.createAuthenticator({
        _id: id,
        credentialPublicKey: bufferToBase64URLString(credentialPublicKey),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        userAgent,
        publicKey,
        userId: user._id,
        transports: registrationResponse.response.transports,
    });

    // Format the wallet
    const wallet = await formatWallet({
        authenticatorId: id,
        publicKey,
    });

    // Add it to the session
    await setSession({
        username,
        wallet,
    });

    return wallet;
}
