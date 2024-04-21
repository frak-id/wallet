"use client";

import {
    defaultUsername,
    rpId,
    rpName,
} from "@/context/wallet/smartWallet/webAuthN";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { keccak256, toHex } from "viem";

/**
 * Generate the webauthn registration options for a user
 * @param excludeCredentials
 */
export async function getRegisterOptions({
    excludeCredentials,
}: {
    excludeCredentials?: {
        id: string;
        transports?: AuthenticatorTransportFuture[];
    }[];
} = {}) {
    // Get the username id
    const userId = keccak256(toHex(defaultUsername)).slice(2);

    // Generate the registration options
    return await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: userId,
        userName: defaultUsername,
        userDisplayName: defaultUsername,
        timeout: 120_000,
        attestationType: "direct",
        authenticatorSelection: {
            requireResidentKey: true,
            // authenticatorAttachment: "platform", TODO: With that we can specify mobile / desktop / or neither
            userVerification: "required",
        },
        supportedAlgorithmIDs: [-7],
        excludeCredentials:
            excludeCredentials?.map((cred) => ({
                id: base64URLStringToBuffer(cred.id),
                type: "public-key",
                transports: cred.transports,
            })) ?? [],
    });
}
