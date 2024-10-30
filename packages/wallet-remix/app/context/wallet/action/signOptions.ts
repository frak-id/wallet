import { WebAuthN } from "@frak-labs/app-essentials";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import type { Hex } from "viem";

/**
 * Generate the webauthn signature options for a user
 * @param authenticatorId
 * @param toSign
 * @param transports
 */
export async function getSignOptions({
    authenticatorId,
    toSign,
    transports,
}: { authenticatorId: string; toSign: Hex; transports?: string[] }) {
    // Build the options
    return await generateAuthenticationOptions({
        rpID: WebAuthN.rpId,
        allowCredentials: [
            {
                id: authenticatorId,
                transports: transports as
                    | AuthenticatorTransportFuture[]
                    | undefined,
            },
        ],
        userVerification: "required",
        challenge: Buffer.from(toSign.slice(2), "hex"),
        // timeout in ms (3min, can be useful for mobile phone linking)
        timeout: 180_000,
    });
}
