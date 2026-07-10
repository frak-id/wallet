import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
} from "node:crypto";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { createTOTPKeyURI, verifyTOTPWithGracePeriod } from "@oslojs/otp";
import { renderSVG } from "uqr";
import { bytesToHex, type Hex, hexToBytes } from "viem";
import type { BusinessTotpRepository } from "../repositories/BusinessTotpRepository";

const TOTP_INTERVAL_SEC = 30;
const TOTP_DIGITS = 6;
/** ±1 interval of clock drift tolerance. */
const TOTP_GRACE_SEC = 30;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars

export type TotpSetup = {
    otpauthUri: string;
    qrSvg: string;
};

/**
 * TOTP enrollment + verification. Secrets are AES-256-GCM encrypted at rest
 * with a key derived from `MASTER_KEY_SECRET` (same HMAC-SHA256 derivation
 * pattern as `AdminWalletsRepository`, dedicated derivation label). Stored
 * blob layout: iv (12B) ‖ ciphertext ‖ auth tag (16B), hex-encoded.
 */
export class TotpService {
    private encryptionKey: Buffer | null = null;

    constructor(private readonly totpRepository: BusinessTotpRepository) {}

    private getEncryptionKey(): Buffer {
        if (this.encryptionKey) return this.encryptionKey;
        if (!process.env.MASTER_KEY_SECRET) {
            throw new Error("Missing MASTER_KEY_SECRET");
        }
        const { masterPrivateKey } = JSON.parse(
            process.env.MASTER_KEY_SECRET
        ) as { masterPrivateKey: string };
        if (!masterPrivateKey) {
            throw new Error("Missing masterPrivateKey in the secret");
        }
        const hmac = createHmac(
            "sha256",
            hexToBytes(`0x${masterPrivateKey.replace(/^0x/, "")}`)
        );
        hmac.update("business-totp-encryption");
        this.encryptionKey = hmac.digest();
        return this.encryptionKey;
    }

    private encryptSecret(secret: Uint8Array): Hex {
        const iv = randomBytes(12);
        const cipher = createCipheriv(
            "aes-256-gcm",
            this.getEncryptionKey(),
            iv
        );
        const ciphertext = Buffer.concat([
            cipher.update(secret),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return bytesToHex(Buffer.concat([iv, ciphertext, tag]));
    }

    private decryptSecret(blob: Hex): Uint8Array {
        const raw = Buffer.from(hexToBytes(blob));
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(raw.length - 16);
        const ciphertext = raw.subarray(12, raw.length - 16);
        const decipher = createDecipheriv(
            "aes-256-gcm",
            this.getEncryptionKey(),
            iv
        );
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }

    private hashRecoveryCode(code: string): string {
        return encodeHexLowerCase(
            sha256(new TextEncoder().encode(code.trim().toLowerCase()))
        );
    }

    /**
     * Begin (or restart) enrollment: mint a fresh 20-byte secret, persist it
     * encrypted and un-activated, return the otpauth URI + QR. Refuses to
     * overwrite an activated enrollment.
     */
    async setup(params: {
        accountId: string;
        accountLabel: string;
    }): Promise<TotpSetup> {
        const existing = await this.totpRepository.findByAccount(
            params.accountId
        );
        if (existing?.activatedAt) {
            throw new Error("TOTP already activated for this account");
        }

        const secret = crypto.getRandomValues(new Uint8Array(20));
        await this.totpRepository.upsertPending({
            accountId: params.accountId,
            encryptedSecret: this.encryptSecret(secret),
        });

        const otpauthUri = createTOTPKeyURI(
            "Frak Business",
            params.accountLabel,
            secret,
            TOTP_INTERVAL_SEC,
            TOTP_DIGITS
        );
        return { otpauthUri, qrSvg: renderSVG(otpauthUri) };
    }

    /**
     * Confirm enrollment with a first valid code. Returns the recovery codes
     * — shown exactly once, only their hashes are stored.
     */
    async activate(params: {
        accountId: string;
        code: string;
    }): Promise<{ recoveryCodes: string[] } | null> {
        const row = await this.totpRepository.findByAccount(params.accountId);
        if (!row || row.activatedAt) return null;

        const valid = this.verifyCode(row.encryptedSecret, params.code);
        if (!valid) return null;

        const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
            randomBytes(RECOVERY_CODE_BYTES).toString("hex")
        );
        await this.totpRepository.activate({
            accountId: params.accountId,
            recoveryCodesHash: recoveryCodes.map((code) =>
                this.hashRecoveryCode(code)
            ),
        });
        return { recoveryCodes };
    }

    /**
     * Verify a TOTP code (or a single-use recovery code) for an activated
     * enrollment.
     */
    async verify(params: {
        accountId: string;
        code: string;
    }): Promise<boolean> {
        const row = await this.totpRepository.findByAccount(params.accountId);
        if (!row?.activatedAt) return false;

        if (this.verifyCode(row.encryptedSecret, params.code)) {
            return true;
        }

        // Recovery-code fallback (single-use)
        const codeHash = this.hashRecoveryCode(params.code);
        if (row.recoveryCodesHash?.includes(codeHash)) {
            await this.totpRepository.consumeRecoveryCode(
                params.accountId,
                codeHash
            );
            return true;
        }

        return false;
    }

    async isActivated(accountId: string): Promise<boolean> {
        const row = await this.totpRepository.findByAccount(accountId);
        return !!row?.activatedAt;
    }

    private verifyCode(encryptedSecret: Hex, code: string): boolean {
        if (!/^\d{6}$/.test(code.trim())) return false;
        const secret = this.decryptSecret(encryptedSecret);
        return verifyTOTPWithGracePeriod(
            secret,
            TOTP_INTERVAL_SEC,
            TOTP_DIGITS,
            code.trim(),
            TOTP_GRACE_SEC
        );
    }
}
