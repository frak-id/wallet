"use client";

import {
    defaultUsername,
    rpId,
    rpName,
} from "@/context/wallet/smartWallet/webAuthN";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type {
    AuthenticatorTransportFuture,
    Base64URLString,
} from "@simplewebauthn/types";
import { concatHex, fromHex, keccak256, toHex } from "viem";

/**
 * Generate the webauthn registration options for a user
 * @param excludeCredentials
 * @param crossPlatform Should the created credentials be cross platform or no
 */
export async function getRegisterOptions({
    excludeCredentials,
    crossPlatform = false,
}: {
    excludeCredentials?: {
        id: Base64URLString;
        transports?: AuthenticatorTransportFuture[];
    }[];
    crossPlatform?: boolean;
} = {}) {
    // Get the date of the day (JJ-MM-AAAA)
    const date = new Date();
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString();

    // Get the username
    const username = `${defaultUsername}-${day}-${month}-${year}`;

    // Get the user id
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const userId = keccak256(concatHex([toHex(username), toHex(randomBytes)]));

    // Generate the registration options
    return await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: fromHex(userId, "bytes"),
        userName: username,
        userDisplayName: username,
        timeout: 120_000,
        attestationType: "direct",
        authenticatorSelection: {
            requireResidentKey: true,
            authenticatorAttachment: crossPlatform
                ? "cross-platform"
                : undefined,
            userVerification: "required",
        },
        supportedAlgorithmIDs: [-7],
        excludeCredentials:
            excludeCredentials?.map((cred) => ({
                id: cred.id,
                transports: cred.transports,
            })) ?? [],
    });
}
