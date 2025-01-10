import { log } from "@backend-common";
import { CryptoHasher } from "bun";
import { Elysia } from "elysia";

/**
 * Context that will be used to validate hmac signed body
 */
export const bodyHmacContext = new Elysia({
    name: "Context.bodyHmac",
}).decorate(
    { as: "append" },
    {
        validateBodyHmac: ({
            body,
            secret,
            signature,
        }: {
            body: string;
            secret: string;
            signature?: string;
        }) => {
            // hmac hash of the body
            const hasher = new CryptoHasher("sha256", secret);
            hasher.update(body);

            // Convert both to buffer
            const recomputedSignature = hasher.digest();
            const baseSignature = Buffer.from(signature ?? "", "base64");

            // Compare the two
            if (!baseSignature.equals(recomputedSignature)) {
                log.warn(
                    {
                        signature,
                        baseSignature: baseSignature.toString("hex"),
                        recomputedSignatureHex:
                            recomputedSignature.toString("hex"),
                        recomputedSignatureB64:
                            recomputedSignature.toString("base64"),
                    },
                    "Signature mismatch"
                );
            } else {
                log.debug(
                    {
                        recomputedSignature:
                            recomputedSignature.toString("hex"),
                        baseSignature: baseSignature.toString("hex"),
                    },
                    "Signature matches"
                );
            }
        },
    }
);
