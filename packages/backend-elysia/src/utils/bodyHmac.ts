import { CryptoHasher } from "bun";
import { log } from "../common";

/**
 * Validate a hmac signature around a request body
 */
export function validateBodyHmac({
    body,
    secret,
    signature,
}: {
    body: string;
    secret: string;
    signature?: string;
}) {
    // hmac hash of the body
    const hasher = new CryptoHasher("sha256", getRealSecret(secret));
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
            },
            "Signature mismatch"
        );
    } else {
        log.debug(
            {
                recomputedSignature: recomputedSignature.toString("hex"),
                baseSignature: baseSignature.toString("hex"),
            },
            "Signature matches"
        );
    }
}

function getRealSecret(secret?: string): string {
    if (!secret) return "";
    switch (secret) {
        case "SHOPIFY_SECRET":
            return process.env.SHOPIFY_API_SECRET ?? "";
        default:
            return secret;
    }
}
