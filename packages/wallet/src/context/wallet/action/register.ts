"use server";
import { setSession } from "@/context/session/action/session";
import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import {
    decodePublicKey,
    rpId,
    rpOrigin,
} from "@/context/wallet/smartWallet/webAuthN";
import { formatWallet } from "@/context/wallet/utils/walletFormatter";
import { bufferToBase64URLString } from "@simplewebauthn/browser";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import type { Address } from "viem";

/**
 * Validate a new wallet registration
 * @param expectedChallenge
 * @param registrationResponse
 * @param userAgent
 * @param previousWallet
 * @param setCookieSession
 */
export async function validateRegistration({
    expectedChallenge,
    registrationResponse,
    userAgent,
    previousWallet,
    setCookieSession = true,
}: {
    expectedChallenge: string;
    registrationResponse: RegistrationResponseJSON;
    userAgent: string;
    previousWallet?: Address;
    setCookieSession?: boolean;
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

    // Format the wallet
    const wallet = await formatWallet({
        authenticatorId: credentialID,
        publicKey,
        previousWallet,
    });
    await authenticatorRepository.createAuthenticator({
        _id: credentialID,
        smartWalletAddress: wallet.address,
        userAgent,
        credentialPublicKey: bufferToBase64URLString(
            credentialPublicKey.buffer as ArrayBuffer
        ),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        publicKey,
        transports: registrationResponse.response.transports,
    });

    // Add it to the session if wanted
    if (setCookieSession) {
        await setSession({
            wallet,
        });
    }

    return {
        wallet,
    };
}
