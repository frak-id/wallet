import { createHash, randomBytes } from "node:crypto";
import { encodeBase64urlNoPadding } from "@oslojs/encoding";

/** RFC 7636 verifier: 32 random bytes give a 43 character unreserved string. */
export function generateCodeVerifier(): string {
    return encodeBase64urlNoPadding(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
    return encodeBase64urlNoPadding(
        createHash("sha256").update(verifier).digest()
    );
}

export function generateAuthState(): string {
    return encodeBase64urlNoPadding(randomBytes(24));
}
