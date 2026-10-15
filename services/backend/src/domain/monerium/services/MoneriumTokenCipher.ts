import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { AdminWalletsRepository } from "@backend-infrastructure/keys/AdminWalletsRepository";
import { bytesToHex, type Hex, hexToBytes } from "viem";

const KEY_DERIVATION_LABEL = "monerium-token-encryption";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM for Monerium tokens and PKCE verifiers. Blob layout, hex encoded:
 * iv (12B) ‖ ciphertext ‖ auth tag (16B). A fresh random IV is drawn per value.
 */
export class MoneriumTokenCipher {
    private encryptionKey: Buffer | null = null;

    constructor(
        private readonly adminWalletsRepository: AdminWalletsRepository
    ) {}

    private async getKey(): Promise<Buffer> {
        if (this.encryptionKey) return this.encryptionKey;
        const keyBytes =
            await this.adminWalletsRepository.deriveKeyBytes(
                KEY_DERIVATION_LABEL
            );
        this.encryptionKey = Buffer.from(keyBytes);
        return this.encryptionKey;
    }

    async encrypt(plaintext: string): Promise<Hex> {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv("aes-256-gcm", await this.getKey(), iv);
        const ciphertext = Buffer.concat([
            cipher.update(plaintext, "utf8"),
            cipher.final(),
        ]);
        return bytesToHex(Buffer.concat([iv, ciphertext, cipher.getAuthTag()]));
    }

    /** Throws when the blob was altered or encrypted under another key. */
    async decrypt(blob: string): Promise<string> {
        const raw = Buffer.from(hexToBytes(blob as Hex));
        const iv = raw.subarray(0, IV_BYTES);
        const tag = raw.subarray(raw.length - TAG_BYTES);
        const ciphertext = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);
        const decipher = createDecipheriv(
            "aes-256-gcm",
            await this.getKey(),
            iv
        );
        decipher.setAuthTag(tag);
        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString("utf8");
    }
}
