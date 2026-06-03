import { stringToBytes } from "viem";

/**
 * Convert a pass to a cryptographical key.
 *
 * Kept for the legacy restore flow (`recovery/utils/decrypt.ts`), which still
 * reads blobs sealed with the old 300k-iteration format. New setup code uses
 * `recoveryBlob.ts` (600k iterations); do not reuse this for new blobs.
 *
 * @param pass
 * @param salt
 */
export async function passToKey({
    pass,
    salt,
}: {
    pass: string;
    salt: Uint8Array;
}) {
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(stringToBytes(pass)),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    // Create the derivated private key
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: new Uint8Array(salt),
            iterations: 300_000,
            hash: "SHA-512",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}
