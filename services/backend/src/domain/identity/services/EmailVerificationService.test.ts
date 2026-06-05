import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailVerificationRepository } from "../repositories/EmailVerificationRepository";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { EmailSender } from "./EmailSender";
import { EmailVerificationService } from "./EmailVerificationService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@backend-infrastructure/integrations/email", () => ({
    buildVerificationEmail: vi.fn(() => ({
        subject: "Verify your email",
        html: "<html></html>",
    })),
}));

const GROUP_ID = "group-1";

const createEmailVerificationRepository = () =>
    ({
        findByGroup: vi.fn(),
        upsert: vi.fn(),
        incrementAttempts: vi.fn(),
        consume: vi.fn(),
        deleteExpired: vi.fn(),
    }) as unknown as EmailVerificationRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const createIdentityRepository = () =>
    ({
        findEmailStatusForGroup: vi.fn(),
        attachVerifiedEmail: vi.fn(async () => true),
        unlinkOtherActiveEmails: vi.fn(),
    }) as unknown as IdentityRepository &
        Record<string, ReturnType<typeof vi.fn>>;

const createEmailSender = () =>
    ({ send: vi.fn(async () => ({ id: "msg-1" })) }) as unknown as EmailSender &
        Record<string, ReturnType<typeof vi.fn>>;

describe("EmailVerificationService", () => {
    let emailVerificationRepository: ReturnType<
        typeof createEmailVerificationRepository
    >;
    let identityRepository: ReturnType<typeof createIdentityRepository>;
    let emailSender: ReturnType<typeof createEmailSender>;
    let service: EmailVerificationService;

    beforeEach(() => {
        process.env.FRAK_WALLET_URL = "https://wallet.test";
        emailVerificationRepository = createEmailVerificationRepository();
        identityRepository = createIdentityRepository();
        emailSender = createEmailSender();
        service = new EmailVerificationService(
            emailVerificationRepository as unknown as EmailVerificationRepository,
            identityRepository as unknown as IdentityRepository,
            emailSender as unknown as EmailSender
        );
    });

    describe("sendCode", () => {
        it("sends a 6-digit code to the group's current email", async () => {
            identityRepository.findEmailStatusForGroup.mockResolvedValue({
                email: "user@test.com",
                verifiedAt: null,
                pendingEmail: null,
            });
            emailVerificationRepository.findByGroup.mockResolvedValue(null);

            const result = await service.sendCode({ groupId: GROUP_ID });

            expect(result).toEqual({ status: "sent" });
            expect(emailVerificationRepository.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    groupId: GROUP_ID,
                    email: "user@test.com",
                    code: expect.stringMatching(/^\d{6}$/),
                })
            );
            expect(emailSender.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "user@test.com" })
            );
        });

        it("throttles a resend inside the 30s debounce window", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue({
                lastSentAt: new Date(),
            });

            const result = await service.sendCode({ groupId: GROUP_ID });

            expect(result.status).toBe("throttled");
            if (result.status === "throttled") {
                expect(result.retryAfterSec).toBeGreaterThan(0);
                expect(result.retryAfterSec).toBeLessThanOrEqual(30);
            }
            expect(emailVerificationRepository.upsert).not.toHaveBeenCalled();
            expect(emailSender.send).not.toHaveBeenCalled();
        });

        it("sends a code to a new address without attaching it (rotation)", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(null);

            const result = await service.sendCode({
                groupId: GROUP_ID,
                email: "New@Test.com",
            });

            expect(result).toEqual({ status: "sent" });
            expect(emailVerificationRepository.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    groupId: GROUP_ID,
                    email: "new@test.com",
                    code: expect.stringMatching(/^\d{6}$/),
                })
            );
            expect(emailSender.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "new@test.com" })
            );
            expect(
                identityRepository.attachVerifiedEmail
            ).not.toHaveBeenCalled();
            expect(
                identityRepository.findEmailStatusForGroup
            ).not.toHaveBeenCalled();
        });

        it("resends to the in-flight challenge target when no address is given", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue({
                email: "rotating@test.com",
                lastSentAt: new Date(Date.now() - 60_000),
                consumedAt: null,
                expiresAt: new Date(Date.now() + 60_000),
            });

            const result = await service.sendCode({ groupId: GROUP_ID });

            expect(result).toEqual({ status: "sent" });
            expect(emailSender.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: "rotating@test.com" })
            );
            expect(
                identityRepository.findEmailStatusForGroup
            ).not.toHaveBeenCalled();
        });

        it("throws when there is no email to verify", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(null);
            identityRepository.findEmailStatusForGroup.mockResolvedValue({
                email: null,
                verifiedAt: null,
                pendingEmail: null,
            });

            await expect(
                service.sendCode({ groupId: GROUP_ID })
            ).rejects.toMatchObject({ code: "NO_EMAIL" });
        });
    });

    describe("verifyCode", () => {
        const validRow = () => ({
            email: "user@test.com",
            code: "123456",
            attempts: 0,
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
        });

        it("returns expired when no challenge exists", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(null);

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result).toEqual({ status: "expired" });
        });

        it("returns expired for a past-expiry challenge", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue({
                ...validRow(),
                expiresAt: new Date(Date.now() - 1_000),
            });

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result).toEqual({ status: "expired" });
        });

        it("returns alreadyVerified for a consumed challenge even past expiry", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue({
                ...validRow(),
                consumedAt: new Date(),
                expiresAt: new Date(Date.now() - 1_000),
            });

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result).toEqual({
                status: "alreadyVerified",
                email: "user@test.com",
            });
            expect(
                identityRepository.attachVerifiedEmail
            ).not.toHaveBeenCalled();
            expect(emailVerificationRepository.consume).not.toHaveBeenCalled();
        });

        it("returns tooManyAttempts past the cap", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue({
                ...validRow(),
                attempts: 5,
            });

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result).toEqual({ status: "tooManyAttempts" });
        });

        it("increments attempts and returns invalid on mismatch", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(
                validRow()
            );

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "000000",
            });

            expect(result).toEqual({ status: "invalid" });
            expect(
                emailVerificationRepository.incrementAttempts
            ).toHaveBeenCalledWith(GROUP_ID);
            expect(
                identityRepository.attachVerifiedEmail
            ).not.toHaveBeenCalled();
        });

        it("attaches the email, unlinks others and consumes on a correct code", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(
                validRow()
            );

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result.status).toBe("verified");
            if (result.status === "verified") {
                expect(result.email).toBe("user@test.com");
                expect(typeof result.verifiedAt).toBe("string");
            }
            expect(identityRepository.attachVerifiedEmail).toHaveBeenCalledWith(
                GROUP_ID,
                "user@test.com"
            );
            expect(
                identityRepository.unlinkOtherActiveEmails
            ).toHaveBeenCalledWith(GROUP_ID, "user@test.com");
            expect(emailVerificationRepository.consume).toHaveBeenCalledWith(
                GROUP_ID
            );
        });

        it("skips the unlink but still consumes when the address is owned by another group", async () => {
            emailVerificationRepository.findByGroup.mockResolvedValue(
                validRow()
            );
            identityRepository.attachVerifiedEmail.mockResolvedValue(false);

            const result = await service.verifyCode({
                groupId: GROUP_ID,
                code: "123456",
            });

            expect(result.status).toBe("verified");
            expect(
                identityRepository.unlinkOtherActiveEmails
            ).not.toHaveBeenCalled();
            expect(emailVerificationRepository.consume).toHaveBeenCalledWith(
                GROUP_ID
            );
        });
    });
});
