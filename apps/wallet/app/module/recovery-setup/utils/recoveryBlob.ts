import {
    base64URLStringToBuffer,
    bufferToBase64URLString,
} from "@frak-labs/wallet-shared/common/utils/base64url";
import { tryit } from "radash";
import {
    type Address,
    bytesToHex,
    getAddress,
    type Hex,
    hexToBytes,
} from "viem";

/**
 * Recovery blob format (the contract between setup and the future restore flow):
 *
 *   plaintext (52 bytes) = address(20) ‖ burnerPrivateKey(32)
 *   envelope  (97 bytes) = version(1) ‖ iv(12) ‖ salt(16) ‖ AES-GCM(plaintext)+tag(16)
 *   blob = base64url(envelope)
 *
 * Sealed client-side with the user's password (PBKDF2-SHA512 → AES-GCM-256). The
 * backend stores `blob` opaquely and never decrypts; password verification is the
 * AES-GCM tag check in `decodeRecoveryBlob`, run locally.
 */
const BLOB_VERSION = 0x01;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 600_000;
const ADDRESS_BYTES = 20;
const PRIVATE_KEY_BYTES = 32;
const PLAINTEXT_BYTES = ADDRESS_BYTES + PRIVATE_KEY_BYTES;
const GCM_TAG_BYTES = 16;
const ENVELOPE_BYTES =
    1 + IV_LENGTH + SALT_LENGTH + PLAINTEXT_BYTES + GCM_TAG_BYTES;

export type RecoveryBlobContent = {
    smartWalletAddress: Address;
    burnerPrivateKey: Hex;
};

/**
 * Structural-only check (NOT a password check): a valid base64url envelope of
 * the right version and size. A wrong password still only fails later as a
 * failed AES-GCM tag in `decodeRecoveryBlob`.
 */
export function isRecoveryBlobEnvelope(blob: string): boolean {
    const [, buffer] = tryit(() => base64URLStringToBuffer(blob))();
    if (!buffer) {
        return false;
    }
    const envelope = new Uint8Array(buffer);
    return envelope.length === ENVELOPE_BYTES && envelope[0] === BLOB_VERSION;
}

async function deriveKey(
    password: string,
    salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-512",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encodeRecoveryBlob({
    smartWalletAddress,
    burnerPrivateKey,
    password,
}: RecoveryBlobContent & { password: string }): Promise<string> {
    const plaintext = new Uint8Array(PLAINTEXT_BYTES);
    plaintext.set(hexToBytes(smartWalletAddress), 0);
    plaintext.set(hexToBytes(burnerPrivateKey), ADDRESS_BYTES);

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await deriveKey(password, salt);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
    );

    const envelope = new Uint8Array(
        1 + IV_LENGTH + SALT_LENGTH + ciphertext.length
    );
    envelope[0] = BLOB_VERSION;
    envelope.set(iv, 1);
    envelope.set(salt, 1 + IV_LENGTH);
    envelope.set(ciphertext, 1 + IV_LENGTH + SALT_LENGTH);

    return bufferToBase64URLString(envelope);
}

/**
 * Decrypt a blob. Returns `null` for a wrong password (failed AES-GCM tag), an
 * unknown version, or a malformed payload — the `null` is the password-test result.
 */
export async function decodeRecoveryBlob({
    blob,
    password,
}: {
    blob: string;
    password: string;
}): Promise<RecoveryBlobContent | null> {
    const envelope = new Uint8Array(base64URLStringToBuffer(blob));
    if (envelope[0] !== BLOB_VERSION) {
        return null;
    }

    const iv = envelope.slice(1, 1 + IV_LENGTH);
    const salt = envelope.slice(1 + IV_LENGTH, 1 + IV_LENGTH + SALT_LENGTH);
    const ciphertext = envelope.slice(1 + IV_LENGTH + SALT_LENGTH);
    const key = await deriveKey(password, salt);

    const [, plaintext] = await tryit(() =>
        crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
    )();
    if (!plaintext) {
        return null;
    }

    const bytes = new Uint8Array(plaintext);
    if (bytes.length !== PLAINTEXT_BYTES) {
        return null;
    }

    return {
        smartWalletAddress: getAddress(
            bytesToHex(bytes.slice(0, ADDRESS_BYTES))
        ),
        burnerPrivateKey: bytesToHex(bytes.slice(ADDRESS_BYTES)),
    };
}
