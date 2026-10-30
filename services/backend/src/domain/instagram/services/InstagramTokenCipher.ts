import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { AdminWalletsRepository } from "@backend-infrastructure/keys/AdminWalletsRepository";

const KEY_DERIVATION_LABEL = "instagram-token-encryption";
const BLOB_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM, base64 of version (1B) ‖ iv (12B) ‖ ciphertext ‖ tag (16B).
 * The account name is authenticated, so a blob moved to another row fails.
 */
export class InstagramTokenCipher {
    constructor(
        private readonly adminWalletsRepository: AdminWalletsRepository
    ) {}

    private async key(): Promise<Buffer> {
        return Buffer.from(
            await this.adminWalletsRepository.deriveKeyBytes(
                KEY_DERIVATION_LABEL
            )
        );
    }

    async encrypt(plaintext: string, account: string): Promise<string> {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv("aes-256-gcm", await this.key(), iv);
        cipher.setAAD(Buffer.from(account));
        const ciphertext = Buffer.concat([
            cipher.update(plaintext, "utf8"),
            cipher.final(),
        ]);
        return Buffer.concat([
            Buffer.from([BLOB_VERSION]),
            iv,
            ciphertext,
            cipher.getAuthTag(),
        ]).toString("base64");
    }

    async decrypt(blob: string, account: string): Promise<string> {
        const raw = Buffer.from(blob, "base64");
        if (raw.length < 1 + IV_BYTES + TAG_BYTES || raw[0] !== BLOB_VERSION) {
            throw new Error("Malformed Instagram token blob");
        }
        const ivEnd = 1 + IV_BYTES;
        const decipher = createDecipheriv(
            "aes-256-gcm",
            await this.key(),
            raw.subarray(1, ivEnd)
        );
        decipher.setAAD(Buffer.from(account));
        decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
        return Buffer.concat([
            decipher.update(raw.subarray(ivEnd, raw.length - TAG_BYTES)),
            decipher.final(),
        ]).toString("utf8");
    }
}
