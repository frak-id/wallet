"use server";

import { triggerFrkAirdrop } from "@/context/mock/action/airdropFrk";
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
import { guard } from "radash";
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
        credentialPublicKey: bufferToBase64URLString(credentialPublicKey),
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

    // Trigger a frk airdrop
    await guard(() =>
        triggerFrkAirdrop({
            user: wallet.address,
            amount: "100",
        })
    );

    return {
        wallet,
    };
}
