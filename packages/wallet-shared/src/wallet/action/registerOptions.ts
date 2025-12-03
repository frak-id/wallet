import { WebAuthN } from "@frak-labs/app-essentials";

/**
 * Generate the webauthn registration options for a user
 * @param excludeCredentials
 * @param crossPlatform Should the created credentials be cross platform or no
 */
export function getRegisterOptions() {
    // Get the date of the day (JJ-MM-AAAA)
    const date = new Date();
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString();

    // Get the username
    const username = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

    // Generate the registration options using ox
    return {
        rp: {
            id: WebAuthN.rpId,
            name: WebAuthN.rpName,
        },
        user: {
            name: username,
            displayName: username,
        },
        // timeout in ms (3min, can be useful for mobile phone linking)
        timeout: 180_000,
        attestation: "direct",
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
            requireResidentKey: false,
        },
    } as const;
}
