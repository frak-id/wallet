import { getAuthenticatorRepository } from "@/context/wallet/repository/AuthenticatorRepository";
import { rpId } from "@/context/wallet/smartWallet/webAuthN";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
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
        rpID: rpId,
        allowCredentials: [
            {
                id: base64URLStringToBuffer(authenticator._id),
                type: "public-key",
                transports: authenticator.transports,
            },
        ],
        userVerification: "required",
        challenge: Buffer.from(toSign.slice(2), "hex"),
    });
}
