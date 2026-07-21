import { timingSafeEqual } from "node:crypto";
import { CryptoHasher } from "bun";

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

    // Compare the two in constant time (timingSafeEqual throws on length
    // mismatch, so guard that case explicitly rather than leaking via a throw)
    if (
        baseSignature.length !== recomputedSignature.length ||
        !timingSafeEqual(baseSignature, recomputedSignature)
    ) {
        throw new Error("Webhook signature verification failed");
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
