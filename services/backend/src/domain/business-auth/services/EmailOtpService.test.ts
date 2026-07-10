import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resendClient } from "../../../infrastructure/integrations/email";
import type { BusinessEmailCodeSelect } from "../db/schema";
import type { BusinessEmailCodeRepository } from "../repositories/BusinessEmailCodeRepository";
import { EMAIL_OTP, EmailOtpService } from "./EmailOtpService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../infrastructure/integrations/email", () => ({
    buildSecurityCodeEmail: vi.fn(() => ({
        subject: "Security code",
        html: "<html></html>",
    })),
    resendClient: { send: vi.fn() },
}));

const ACCOUNT_ID = "acc-1";

const createRepository = () =>
    ({
        find: vi.fn(),
        upsert: vi.fn(),
        incrementAttempts: vi.fn(),
        consume: vi.fn(),
    }) as unknown as BusinessEmailCodeRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const row = (
    overrides: Partial<BusinessEmailCodeSelect>
): BusinessEmailCodeSelect =>
    ({
        id: "row-1",
        accountId: ACCOUNT_ID,
        purpose: "second_factor",
        codeHash: "irrelevant",
        attempts: 0,
        createdAt: new Date(),
        lastSentAt: new Date(Date.now() - EMAIL_OTP.RESEND_DEBOUNCE_MS - 1000),
        sendCount: 1,
        sendWindowStartedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + EMAIL_OTP.CODE_TTL_MS),
        consumedAt: null,
        ...overrides,
    }) as BusinessEmailCodeSelect;

describe("EmailOtpService", () => {
    let repository: ReturnType<typeof createRepository>;
    let service: EmailOtpService;

    beforeEach(() => {
        vi.mocked(resendClient.send)
            .mockReset()
            .mockResolvedValue({ id: "msg-1" });
        repository = createRepository();
        service = new EmailOtpService(
            repository as unknown as BusinessEmailCodeRepository
        );
    });

    describe("sendCode", () => {
        it("sends a 6-digit code and persists its hash (not the code)", async () => {
            repository.find.mockResolvedValue(null);

            const result = await service.sendCode({
                accountId: ACCOUNT_ID,
                email: "user@test.com",
                purpose: "second_factor",
            });

            expect(result).toEqual({ status: "sent" });
            expect(resendClient.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "user@test.com" })
            );
            const stored = repository.upsert.mock.calls[0][0];
            expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
        });

        it("throttles within the resend debounce window", async () => {
            repository.find.mockResolvedValue(
                row({ lastSentAt: new Date(Date.now() - 10_000) })
            );

            const result = await service.sendCode({
                accountId: ACCOUNT_ID,
                email: "user@test.com",
                purpose: "second_factor",
            });

            expect(result.status).toBe("throttled");
            expect(resendClient.send).not.toHaveBeenCalled();
            expect(repository.upsert).not.toHaveBeenCalled();
        });

        it("throttles after the hourly send cap is reached, independent of the debounce", async () => {
            repository.find.mockResolvedValue(
                row({
                    lastSentAt: new Date(
                        Date.now() - EMAIL_OTP.RESEND_DEBOUNCE_MS - 1000
                    ),
                    sendCount: EMAIL_OTP.MAX_SENDS_PER_WINDOW,
                    sendWindowStartedAt: new Date(Date.now() - 5000),
                })
            );

            const result = await service.sendCode({
                accountId: ACCOUNT_ID,
                email: "user@test.com",
                purpose: "second_factor",
            });

            expect(result.status).toBe("throttled");
            expect(resendClient.send).not.toHaveBeenCalled();
            expect(repository.upsert).not.toHaveBeenCalled();
        });

        it("resets the send-rate window once an hour has elapsed", async () => {
            repository.find.mockResolvedValue(
                row({
                    lastSentAt: new Date(
                        Date.now() - EMAIL_OTP.RESEND_DEBOUNCE_MS - 1000
                    ),
                    sendCount: EMAIL_OTP.MAX_SENDS_PER_WINDOW,
                    sendWindowStartedAt: new Date(
                        Date.now() - EMAIL_OTP.SEND_WINDOW_MS - 1000
                    ),
                })
            );

            const result = await service.sendCode({
                accountId: ACCOUNT_ID,
                email: "user@test.com",
                purpose: "second_factor",
            });

            expect(result).toEqual({ status: "sent" });
            const stored = repository.upsert.mock.calls[0][0];
            expect(stored.sendCount).toBe(1);
        });

        it("increments the send count within an active window", async () => {
            repository.find.mockResolvedValue(
                row({
                    lastSentAt: new Date(
                        Date.now() - EMAIL_OTP.RESEND_DEBOUNCE_MS - 1000
                    ),
                    sendCount: 2,
                    sendWindowStartedAt: new Date(Date.now() - 5000),
                })
            );

            await service.sendCode({
                accountId: ACCOUNT_ID,
                email: "user@test.com",
                purpose: "second_factor",
            });

            const stored = repository.upsert.mock.calls[0][0];
            expect(stored.sendCount).toBe(3);
        });

        it("does not persist when the provider send fails", async () => {
            repository.find.mockResolvedValue(null);
            vi.mocked(resendClient.send).mockRejectedValue(new Error("boom"));

            await expect(
                service.sendCode({
                    accountId: ACCOUNT_ID,
                    email: "user@test.com",
                    purpose: "second_factor",
                })
            ).rejects.toThrow();
            expect(repository.upsert).not.toHaveBeenCalled();
        });
    });

    describe("verifyCode", () => {
        // Same hashing as the service (sha256 of the trimmed code).
        const hashOf = (code: string) =>
            encodeHexLowerCase(sha256(new TextEncoder().encode(code.trim())));

        it("verifies a matching code and consumes it", async () => {
            repository.find.mockResolvedValue(
                row({ codeHash: hashOf("123456") })
            );

            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: "123456",
            });

            expect(result.status).toBe("verified");
            expect(repository.consume).toHaveBeenCalledWith(
                ACCOUNT_ID,
                "second_factor"
            );
        });

        it("normalizes whitespace on the provided code", async () => {
            repository.find.mockResolvedValue(
                row({ codeHash: hashOf("123456") })
            );
            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: " 123456 ",
            });
            expect(result.status).toBe("verified");
        });

        it("rejects an expired code", async () => {
            repository.find.mockResolvedValue(
                row({ expiresAt: new Date(Date.now() - 1000) })
            );
            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: "123456",
            });
            expect(result.status).toBe("expired");
        });

        it("rejects a consumed code", async () => {
            repository.find.mockResolvedValue(row({ consumedAt: new Date() }));
            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: "123456",
            });
            expect(result.status).toBe("expired");
        });

        it("locks out after max attempts", async () => {
            repository.find.mockResolvedValue(
                row({ attempts: EMAIL_OTP.MAX_VERIFY_ATTEMPTS })
            );
            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: "123456",
            });
            expect(result.status).toBe("tooManyAttempts");
        });

        it("increments attempts on a wrong code", async () => {
            repository.find.mockResolvedValue(row({ codeHash: "nope" }));
            const result = await service.verifyCode({
                accountId: ACCOUNT_ID,
                purpose: "second_factor",
                code: "123456",
            });
            expect(result.status).toBe("invalid");
            expect(repository.incrementAttempts).toHaveBeenCalledWith(
                ACCOUNT_ID,
                "second_factor"
            );
        });
    });
});
