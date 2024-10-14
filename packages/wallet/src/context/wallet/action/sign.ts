"use server";

import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import { WebAuthN } from "@frak-labs/app-essentials";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { Hex } from "viem";

/**
 * Generate the webauthn signature options for a user
 * @param authenticatorId
 * @param toSign
 */
export async function getSignOptions({
    authenticatorId,
    toSign,
}: { authenticatorId: string; toSign: Hex }) {
    const authenticatorRepository = await getAuthenticatorRepository();

    // Get the current authenticators for the user
    const authenticator =
        await authenticatorRepository.getByCredentialId(authenticatorId);
    if (!authenticator) {
        throw new Error("No authenticator found for this id");
    }

    // Build the options
    return await generateAuthenticationOptions({
        rpID: WebAuthN.rpId,
        allowCredentials: [
            {
                id: authenticator._id,
                transports: authenticator.transports,
            },
        ],
        userVerification: "required",
        challenge: Buffer.from(toSign.slice(2), "hex"),
        // timeout in ms (3min, can be useful for mobile phone linking)
        timeout: 180_000,
    });
}
