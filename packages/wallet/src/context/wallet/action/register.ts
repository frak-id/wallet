"use server";

import { setSession } from "@/context/session/action/session";
import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import {
    decodePublicKey,
    defaultUsername,
    rpId,
    rpOrigin,
} from "@/context/wallet/smartWallet/webAuthN";
import { formatWallet } from "@/context/wallet/utils/walletFormatter";
import { bufferToBase64URLString } from "@simplewebauthn/browser";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

/**
 * Validate a new wallet registration
 * @param username
 * @param expectedChallenge
 * @param registrationResponse
 * @param userAgent
 */
export async function validateRegistration({
    expectedChallenge,
    registrationResponse,
    userAgent,
}: {
    expectedChallenge: string;
    registrationResponse: RegistrationResponseJSON;
    userAgent: string;
}) {
    const authenticatorRepository = await getAuthenticatorRepository();

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: rpOrigin,
        expectedRPID: rpId,
    });
    if (!verification.registrationInfo) {
        console.error("Registration failed", {
            verification,
            expectedChallenge,
            response: registrationResponse,
            rpOrigin,
            rpId,
        });
        throw new Error("Registration failed");
    }

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
        userAgent,
        username: defaultUsername,
        credentialPublicKey: bufferToBase64URLString(credentialPublicKey),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        publicKey,
        transports: registrationResponse.response.transports,
    });

    // Format the wallet
    const wallet = await formatWallet({
        authenticatorId: id,
        publicKey,
    });

    // Add it to the session
    await setSession({
        username: defaultUsername,
        wallet,
    });

    return {
        username: defaultUsername,
        wallet,
    };
}
