import { generateTOTP } from "@oslojs/otp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import type { BusinessAccountRepository } from "../repositories/BusinessAccountRepository";
import { TWO_FACTOR_LOCKOUT } from "./attemptGuard";
import { TotpService } from "./TotpService";

// MASTER_KEY_SECRET is set by the global vitest-setup.

const ACCOUNT_ID = "acc-1";

const createRepository = () =>
    ({
        findById: vi.fn(),
        setPendingTotp: vi.fn(),
        activateTotp: vi.fn(),
        consumeTotpRecoveryCode: vi.fn().mockResolvedValue(false),
        recordTwoFactorFailure: vi.fn(),
        resetTwoFactorAttempts: vi.fn(),
    }) as unknown as BusinessAccountRepository &
        Record<string, ReturnType<typeof vi.fn>>;

describe("TotpService", () => {
    let repository: ReturnType<typeof createRepository>;
    let service: TotpService;

    beforeEach(() => {
        repository = createRepository();
        service = new TotpService(
            repository as unknown as BusinessAccountRepository,
            new AdminWalletsRepository()
        );
    });

    describe("setup", () => {
        it("persists an encrypted secret and returns the otpauth URI", async () => {
            repository.findById.mockResolvedValue(null);

            const result = await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });

            expect(result.otpauthUri).toContain("otpauth://totp/");
            expect(result.otpauthUri).toContain("Frak%20Business");

            const stored = repository.setPendingTotp.mock.calls[0][0];
            expect(stored.encryptedSecret).toMatch(/^0x[0-9a-f]+$/);
            // iv (12) + secret (20) + tag (16) = 48 bytes = 96 hex chars
            expect(stored.encryptedSecret.length).toBe(2 + 96);
        });

        it("refuses to overwrite an activated enrollment", async () => {
            repository.findById.mockResolvedValue({
                totpActivatedAt: new Date(),
            });

            // Typed conflict (§1.6 / M5), not a bare Error.
            await expect(
                service.setup({
                    accountId: ACCOUNT_ID,
                    accountLabel: "user@test.com",
                })
            ).rejects.toMatchObject({
                status: 409,
                code: "TOTP_ALREADY_ACTIVATED",
            });
        });
    });

    describe("activate + verify (encrypt/decrypt roundtrip)", () => {
        /**
         * Full roundtrip: run setup to get a stored encrypted secret, extract
         * the plaintext secret from the otpauth URI, compute a valid TOTP,
         * then activate and verify against the encrypted-at-rest secret.
         */
        async function setupWithSecret() {
            repository.findById.mockResolvedValue(null);
            const { otpauthUri } = await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });
            const encryptedSecret =
                repository.setPendingTotp.mock.calls[0][0].encryptedSecret;

            // Decode the base32 secret from the otpauth URI
            const secretParam = new URL(otpauthUri).searchParams.get(
                "secret"
            ) as string;
            const secret = base32Decode(secretParam);
            return { encryptedSecret, secret };
        }

        it("activates with a valid code and returns 8 recovery codes", async () => {
            const { encryptedSecret, secret } = await setupWithSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: null,
                totpRecoveryCodesHash: null,
            });

            const code = generateTOTP(secret, 30, 6);
            const result = await service.activate({
                accountId: ACCOUNT_ID,
                code,
            });

            expect(result).not.toBeNull();
            expect(result?.recoveryCodes).toHaveLength(8);
            for (const rc of result?.recoveryCodes ?? []) {
                expect(rc).toMatch(/^[0-9a-f]{10}$/);
            }
            const activated = repository.activateTotp.mock.calls[0][0];
            expect(activated.recoveryCodesHash).toHaveLength(8);
            // Stored hashes never equal the raw codes
            expect(activated.recoveryCodesHash).not.toEqual(
                result?.recoveryCodes
            );
        });

        it("rejects activation with a wrong code", async () => {
            const { encryptedSecret } = await setupWithSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: null,
                totpRecoveryCodesHash: null,
            });

            const result = await service.activate({
                accountId: ACCOUNT_ID,
                code: "000000",
            });
            expect(result).toBeNull();
        });

        it("verifies a valid code on an activated enrollment", async () => {
            const { encryptedSecret, secret } = await setupWithSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: [],
            });

            const code = generateTOTP(secret, 30, 6);
            expect(await service.verify({ accountId: ACCOUNT_ID, code })).toBe(
                true
            );
            expect(
                await service.verify({ accountId: ACCOUNT_ID, code: "000000" })
            ).toBe(false);
        });

        it("refuses to verify a non-activated enrollment", async () => {
            const { encryptedSecret, secret } = await setupWithSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: null,
                totpRecoveryCodesHash: null,
            });

            const code = generateTOTP(secret, 30, 6);
            expect(await service.verify({ accountId: ACCOUNT_ID, code })).toBe(
                false
            );
        });
    });

    describe("recovery codes", () => {
        it("accepts and consumes a recovery code (single-use)", async () => {
            // Build a real enrollment to get a valid encrypted secret
            repository.findById.mockResolvedValue(null);
            await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });
            const encryptedSecret =
                repository.setPendingTotp.mock.calls[0][0].encryptedSecret;

            // sha256("aabbccddee") lowercased-hex — computed via the service's
            // own hashing by activating and replaying is complex; instead
            // verify via the public contract: an unknown code fails.
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: [
                    // sha256 of "aabbccddee"
                    computeSha256Hex("aabbccddee"),
                ],
                twoFactorAttempts: 0,
                twoFactorWindowStartedAt: null,
            });
            // Matching + single-use consumption is now atomic in the repo
            // (§1.7): the service just delegates and trusts the boolean.
            repository.consumeTotpRecoveryCode.mockImplementation(
                async (_id: string, hash: string) =>
                    hash === computeSha256Hex("aabbccddee")
            );

            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "aabbccddee",
                })
            ).toBe(true);
            expect(repository.consumeTotpRecoveryCode).toHaveBeenCalledWith(
                ACCOUNT_ID,
                computeSha256Hex("aabbccddee")
            );
            expect(repository.resetTwoFactorAttempts).toHaveBeenCalled();

            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "0000000000",
                })
            ).toBe(false);
        });
    });

    describe("lockout + failure accounting (§1.8 / §1.7)", () => {
        /** Build a real activated enrollment so `verifyCode` can decrypt. */
        async function setupSecret() {
            repository.findById.mockResolvedValue(null);
            await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });
            return repository.setPendingTotp.mock.calls[0][0].encryptedSecret;
        }

        it("throws TWO_FACTOR_LOCKED once the windowed ceiling is hit", async () => {
            // At the ceiling inside an active window — the guard short-circuits
            // before any decryption, so a dummy secret is fine.
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: "0xdead",
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: [],
                twoFactorAttempts: TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS,
                twoFactorWindowStartedAt: new Date(),
            });

            await expect(
                service.verify({ accountId: ACCOUNT_ID, code: "000000" })
            ).rejects.toMatchObject({
                status: 429,
                code: "TWO_FACTOR_LOCKED",
            });
            expect(repository.recordTwoFactorFailure).not.toHaveBeenCalled();
        });

        it("records a windowed failure on a wrong code", async () => {
            const encryptedSecret = await setupSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: [],
                twoFactorAttempts: 0,
                twoFactorWindowStartedAt: null,
            });
            repository.consumeTotpRecoveryCode.mockResolvedValue(false);

            expect(
                await service.verify({ accountId: ACCOUNT_ID, code: "000000" })
            ).toBe(false);
            expect(repository.recordTwoFactorFailure).toHaveBeenCalledWith({
                accountId: ACCOUNT_ID,
                attempts: 1,
                windowStartedAt: expect.any(Date),
            });
        });

        it("consumes a recovery code exactly once (double-spend safe)", async () => {
            const encryptedSecret = await setupSecret();
            repository.findById.mockResolvedValue({
                id: ACCOUNT_ID,
                totpSecretEnc: encryptedSecret,
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: [computeSha256Hex("aabbccddee")],
                twoFactorAttempts: 0,
                twoFactorWindowStartedAt: null,
            });
            // The atomic conditional UPDATE succeeds once, then the row is gone
            // — a replay of the same code returns false (§1.7).
            repository.consumeTotpRecoveryCode
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "aabbccddee",
                })
            ).toBe(true);
            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "aabbccddee",
                })
            ).toBe(false);
            // The replay counts as a failed attempt.
            expect(repository.recordTwoFactorFailure).toHaveBeenCalledTimes(1);
        });
    });
});

// -- helpers -----------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(encoded: string): Uint8Array {
    const clean = encoded.replace(/=+$/, "");
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    for (const char of clean) {
        value = (value << 5) | BASE32_ALPHABET.indexOf(char);
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(output);
}

function computeSha256Hex(input: string): string {
    // Same normalization + hashing as TotpService.hashRecoveryCode
    const { createHash } = require("node:crypto");
    return createHash("sha256")
        .update(input.trim().toLowerCase())
        .digest("hex");
}
