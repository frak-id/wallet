import { generateTOTP } from "@oslojs/otp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessTotpRepository } from "../repositories/BusinessTotpRepository";
import { TotpService } from "./TotpService";

// MASTER_KEY_SECRET is set by the global vitest-setup.

const ACCOUNT_ID = "acc-1";

const createRepository = () =>
    ({
        findByAccount: vi.fn(),
        upsertPending: vi.fn(),
        activate: vi.fn(),
        consumeRecoveryCode: vi.fn(),
        delete: vi.fn(),
    }) as unknown as BusinessTotpRepository &
        Record<string, ReturnType<typeof vi.fn>>;

describe("TotpService", () => {
    let repository: ReturnType<typeof createRepository>;
    let service: TotpService;

    beforeEach(() => {
        repository = createRepository();
        service = new TotpService(
            repository as unknown as BusinessTotpRepository
        );
    });

    describe("setup", () => {
        it("persists an encrypted secret and returns URI + QR", async () => {
            repository.findByAccount.mockResolvedValue(null);

            const result = await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });

            expect(result.otpauthUri).toContain("otpauth://totp/");
            expect(result.otpauthUri).toContain("Frak%20Business");
            expect(result.qrSvg).toContain("<svg");

            const stored = repository.upsertPending.mock.calls[0][0];
            expect(stored.encryptedSecret).toMatch(/^0x[0-9a-f]+$/);
            // iv (12) + secret (20) + tag (16) = 48 bytes = 96 hex chars
            expect(stored.encryptedSecret.length).toBe(2 + 96);
        });

        it("refuses to overwrite an activated enrollment", async () => {
            repository.findByAccount.mockResolvedValue({
                activatedAt: new Date(),
            });

            await expect(
                service.setup({
                    accountId: ACCOUNT_ID,
                    accountLabel: "user@test.com",
                })
            ).rejects.toThrow("TOTP already activated");
        });
    });

    describe("activate + verify (encrypt/decrypt roundtrip)", () => {
        /**
         * Full roundtrip: run setup to get a stored encrypted secret, extract
         * the plaintext secret from the otpauth URI, compute a valid TOTP,
         * then activate and verify against the encrypted-at-rest secret.
         */
        async function setupWithSecret() {
            repository.findByAccount.mockResolvedValue(null);
            const { otpauthUri } = await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });
            const encryptedSecret =
                repository.upsertPending.mock.calls[0][0].encryptedSecret;

            // Decode the base32 secret from the otpauth URI
            const secretParam = new URL(otpauthUri).searchParams.get(
                "secret"
            ) as string;
            const secret = base32Decode(secretParam);
            return { encryptedSecret, secret };
        }

        it("activates with a valid code and returns 8 recovery codes", async () => {
            const { encryptedSecret, secret } = await setupWithSecret();
            repository.findByAccount.mockResolvedValue({
                accountId: ACCOUNT_ID,
                encryptedSecret,
                activatedAt: null,
                recoveryCodesHash: null,
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
            const activated = repository.activate.mock.calls[0][0];
            expect(activated.recoveryCodesHash).toHaveLength(8);
            // Stored hashes never equal the raw codes
            expect(activated.recoveryCodesHash).not.toEqual(
                result?.recoveryCodes
            );
        });

        it("rejects activation with a wrong code", async () => {
            const { encryptedSecret } = await setupWithSecret();
            repository.findByAccount.mockResolvedValue({
                accountId: ACCOUNT_ID,
                encryptedSecret,
                activatedAt: null,
                recoveryCodesHash: null,
            });

            const result = await service.activate({
                accountId: ACCOUNT_ID,
                code: "000000",
            });
            expect(result).toBeNull();
        });

        it("verifies a valid code on an activated enrollment", async () => {
            const { encryptedSecret, secret } = await setupWithSecret();
            repository.findByAccount.mockResolvedValue({
                accountId: ACCOUNT_ID,
                encryptedSecret,
                activatedAt: new Date(),
                recoveryCodesHash: [],
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
            repository.findByAccount.mockResolvedValue({
                accountId: ACCOUNT_ID,
                encryptedSecret,
                activatedAt: null,
                recoveryCodesHash: null,
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
            repository.findByAccount.mockResolvedValue(null);
            await service.setup({
                accountId: ACCOUNT_ID,
                accountLabel: "user@test.com",
            });
            const encryptedSecret =
                repository.upsertPending.mock.calls[0][0].encryptedSecret;

            // sha256("aabbccddee") lowercased-hex — computed via the service's
            // own hashing by activating and replaying is complex; instead
            // verify via the public contract: an unknown code fails.
            repository.findByAccount.mockResolvedValue({
                accountId: ACCOUNT_ID,
                encryptedSecret,
                activatedAt: new Date(),
                recoveryCodesHash: [
                    // sha256 of "aabbccddee"
                    computeSha256Hex("aabbccddee"),
                ],
            });

            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "aabbccddee",
                })
            ).toBe(true);
            expect(repository.consumeRecoveryCode).toHaveBeenCalled();

            expect(
                await service.verify({
                    accountId: ACCOUNT_ID,
                    code: "0000000000",
                })
            ).toBe(false);
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
