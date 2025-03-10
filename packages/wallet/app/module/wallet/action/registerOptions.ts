import { WebAuthN } from "@frak-labs/app-essentials";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import { generateRegistrationOptions } from "@simplewebauthn/server";
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
    const username = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

    // Get the user id
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const userId = keccak256(concatHex([toHex(username), toHex(randomBytes)]));

    // Generate the registration options
    return await generateRegistrationOptions({
        rpName: WebAuthN.rpName,
        rpID: WebAuthN.rpId,
        userID: fromHex(userId, "bytes"),
        userName: username,
        userDisplayName: username,
        // timeout in ms (3min, can be useful for mobile phone linking)
        timeout: 180_000,
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
