import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { AdminWalletsRepository } from "@backend-infrastructure/keys/AdminWalletsRepository";
import { HttpError, sha256Hex } from "@backend-utils";
import { createTOTPKeyURI, verifyTOTPWithGracePeriod } from "@oslojs/otp";
import { bytesToHex, type Hex, hexToBytes } from "viem";
import type { BusinessAccountRepository } from "../repositories/BusinessAccountRepository";
import { isAttemptAllowed, nextFailureState } from "./attemptGuard";

const TOTP_KEY_DERIVATION_LABEL = "business-totp-encryption";

const TOTP_INTERVAL_SEC = 30;
const TOTP_DIGITS = 6;
/** ±1 interval of clock drift tolerance. */
const TOTP_GRACE_SEC = 30;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars

export type TotpSetup = {
    otpauthUri: string;
};

/**
 * TOTP enrollment + verification. Secrets are AES-256-GCM encrypted at rest
 * with a key derived from `MASTER_KEY_SECRET` via
 * `AdminWalletsRepository.deriveKeyBytes` — the same cached HMAC-SHA256
 * derivation used for onchain signing keys, under a dedicated label so this
 * bytes-only secret can never collide with a wallet key. Stored blob layout:
 * iv (12B) ‖ ciphertext ‖ auth tag (16B), hex-encoded.
 */
export class TotpService {
    private encryptionKey: Buffer | null = null;

    constructor(
        private readonly accountRepository: BusinessAccountRepository,
        private readonly adminWalletsRepository: AdminWalletsRepository
    ) {}

    private async getEncryptionKey(): Promise<Buffer> {
        if (this.encryptionKey) return this.encryptionKey;
        const keyBytes = await this.adminWalletsRepository.deriveKeyBytes(
            TOTP_KEY_DERIVATION_LABEL
        );
        this.encryptionKey = Buffer.from(keyBytes);
        return this.encryptionKey;
    }

    private async encryptSecret(secret: Uint8Array): Promise<Hex> {
        const iv = randomBytes(12);
        const cipher = createCipheriv(
            "aes-256-gcm",
            await this.getEncryptionKey(),
            iv
        );
        const ciphertext = Buffer.concat([
            cipher.update(secret),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return bytesToHex(Buffer.concat([iv, ciphertext, tag]));
    }

    private async decryptSecret(blob: Hex): Promise<Uint8Array> {
        const raw = Buffer.from(hexToBytes(blob));
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(raw.length - 16);
        const ciphertext = raw.subarray(12, raw.length - 16);
        const decipher = createDecipheriv(
            "aes-256-gcm",
            await this.getEncryptionKey(),
            iv
        );
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }

    private hashRecoveryCode(code: string): string {
        return sha256Hex(code.trim().toLowerCase());
    }

    /**
     * Begin (or restart) enrollment: mint a fresh 20-byte secret, persist it
     * encrypted and un-activated, return the otpauth URI. The QR is rendered
     * client-side from this URI (§2.2). Refuses to overwrite an activated
     * enrollment.
     */
    async setup(params: {
        accountId: string;
        accountLabel: string;
    }): Promise<TotpSetup> {
        const existing = await this.accountRepository.findById(
            params.accountId
        );
        if (existing?.totpActivatedAt) {
            throw HttpError.conflict(
                "TOTP_ALREADY_ACTIVATED",
                "TOTP already activated for this account"
            );
        }

        const secret = crypto.getRandomValues(new Uint8Array(20));
        await this.accountRepository.setPendingTotp({
            accountId: params.accountId,
            encryptedSecret: await this.encryptSecret(secret),
        });

        const otpauthUri = createTOTPKeyURI(
            "Frak Business",
            params.accountLabel,
            secret,
            TOTP_INTERVAL_SEC,
            TOTP_DIGITS
        );
        return { otpauthUri };
    }

    /**
     * Confirm enrollment with a first valid code. Returns the recovery codes
     * — shown exactly once, only their hashes are stored.
     */
    async activate(params: {
        accountId: string;
        code: string;
    }): Promise<{ recoveryCodes: string[] } | null> {
        const row = await this.accountRepository.findById(params.accountId);
        if (!row?.totpSecretEnc || row.totpActivatedAt) return null;

        const valid = await this.verifyCode(row.totpSecretEnc, params.code);
        if (!valid) return null;

        const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
            randomBytes(RECOVERY_CODE_BYTES).toString("hex")
        );
        await this.accountRepository.activateTotp({
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
        const row = await this.accountRepository.findById(params.accountId);
        if (!row?.totpSecretEnc || !row.totpActivatedAt) return false;

        // Per-account lockout (§1.8): once the windowed failure counter is
        // exhausted, stop verifying until the window rolls over.
        const attemptState = {
            attempts: row.twoFactorAttempts,
            windowStartedAt: row.twoFactorWindowStartedAt,
        };
        if (!isAttemptAllowed(attemptState)) {
            throw HttpError.tooManyRequests(
                "TWO_FACTOR_LOCKED",
                "Too many failed attempts — try again later"
            );
        }

        if (await this.verifyCode(row.totpSecretEnc, params.code)) {
            await this.accountRepository.resetTwoFactorAttempts(
                params.accountId
            );
            return true;
        }

        // Recovery-code fallback: one atomic conditional UPDATE both matches
        // and single-use-consumes the code (§1.7), immune to double-spend.
        const consumed = await this.accountRepository.consumeTotpRecoveryCode(
            params.accountId,
            this.hashRecoveryCode(params.code)
        );
        if (consumed) {
            await this.accountRepository.resetTwoFactorAttempts(
                params.accountId
            );
            return true;
        }

        // Record the failure against the windowed counter.
        const next = nextFailureState(attemptState);
        await this.accountRepository.recordTwoFactorFailure({
            accountId: params.accountId,
            attempts: next.attempts,
            windowStartedAt: next.windowStartedAt,
        });
        return false;
    }

    private async verifyCode(
        encryptedSecret: Hex,
        code: string
    ): Promise<boolean> {
        if (!/^\d{6}$/.test(code.trim())) return false;
        const secret = await this.decryptSecret(encryptedSecret);
        return verifyTOTPWithGracePeriod(
            secret,
            TOTP_INTERVAL_SEC,
            TOTP_DIGITS,
            code.trim(),
            TOTP_GRACE_SEC
        );
    }
}
