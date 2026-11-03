import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { AdminWalletsRepository } from "@backend-infrastructure/keys/AdminWalletsRepository";
import { type Address, bytesToHex, type Hex, hexToBytes } from "viem";

const KEY_DERIVATION_LABEL = "monerium-token-encryption";
const BLOB_VERSION = 1;
const VERSION_BYTES = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

type MoneriumSecretColumn =
    | "access_token_encrypted"
    | "refresh_token_encrypted"
    | "code_verifier_encrypted";

/** A blob that is malformed, altered, moved to another row or encrypted under another key. */
export class MoneriumCipherIntegrityError extends Error {
    constructor() {
        super("Monerium secret failed its integrity check");
        this.name = "MoneriumCipherIntegrityError";
    }
}

function aad(wallet: Address, column: MoneriumSecretColumn): Buffer {
    return Buffer.from(`${wallet.toLowerCase()}:${column}`);
}

/**
 * AES-256-GCM for Monerium tokens and PKCE verifiers. Blob layout, hex encoded:
 * version (1B) ‖ iv (12B) ‖ ciphertext ‖ auth tag (16B). The wallet and column are
 * authenticated, so a blob copied to another row does not decrypt.
 */
export class MoneriumTokenCipher {
    constructor(
        private readonly adminWalletsRepository: AdminWalletsRepository
    ) {}

    private async getKey(): Promise<Buffer> {
        return Buffer.from(
            await this.adminWalletsRepository.deriveKeyBytes(
                KEY_DERIVATION_LABEL
            )
        );
    }

    async encrypt(
        plaintext: string,
        wallet: Address,
        column: MoneriumSecretColumn
    ): Promise<Hex> {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv("aes-256-gcm", await this.getKey(), iv);
        cipher.setAAD(aad(wallet, column));
        const ciphertext = Buffer.concat([
            cipher.update(plaintext, "utf8"),
            cipher.final(),
        ]);
        return bytesToHex(
            Buffer.concat([
                Buffer.from([BLOB_VERSION]),
                iv,
                ciphertext,
                cipher.getAuthTag(),
            ])
        );
    }

    /**
     * Throws `MoneriumCipherIntegrityError` for a bad blob. A key that cannot be
     * loaded throws its own error, which is not a verdict on the blob.
     */
    async decrypt(
        blob: string,
        wallet: Address,
        column: MoneriumSecretColumn
    ): Promise<string> {
        const key = await this.getKey();
        try {
            const raw = Buffer.from(hexToBytes(blob as Hex));
            if (
                raw.length < VERSION_BYTES + IV_BYTES + TAG_BYTES ||
                raw[0] !== BLOB_VERSION
            ) {
                throw new MoneriumCipherIntegrityError();
            }
            const ivEnd = VERSION_BYTES + IV_BYTES;
            const decipher = createDecipheriv(
                "aes-256-gcm",
                key,
                raw.subarray(VERSION_BYTES, ivEnd)
            );
            decipher.setAAD(aad(wallet, column));
            decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
            return Buffer.concat([
                decipher.update(raw.subarray(ivEnd, raw.length - TAG_BYTES)),
                decipher.final(),
            ]).toString("utf8");
        } catch {
            throw new MoneriumCipherIntegrityError();
        }
    }
}
