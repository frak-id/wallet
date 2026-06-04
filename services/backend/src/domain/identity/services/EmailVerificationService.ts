import { randomInt } from "node:crypto";
import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildVerificationEmail } from "../../../infrastructure/integrations/email";
import type { EmailVerificationRepository } from "../repositories/EmailVerificationRepository";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { EmailSender } from "./EmailSender";

const RESEND_DEBOUNCE_MS = 30_000;
const CODE_TTL_MS = 10 * 60_000;
const MAX_VERIFY_ATTEMPTS = 5;

export type SendCodeResult =
    | { status: "sent" }
    | { status: "throttled"; retryAfterSec: number };

export type VerifyCodeResult =
    | { status: "verified"; email: string; verifiedAt: string }
    | { status: "invalid" }
    | { status: "expired" }
    | { status: "tooManyAttempts" };

export class EmailVerificationService {
    constructor(
        private readonly emailVerificationRepository: EmailVerificationRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly emailSender: EmailSender
    ) {}

    async sendCode({
        groupId,
        email,
    }: {
        groupId: string;
        email?: string;
    }): Promise<SendCodeResult> {
        const target = await this.resolveTarget(groupId, email);

        const existing =
            await this.emailVerificationRepository.findByGroup(groupId);
        if (existing) {
            const elapsedMs = Date.now() - existing.lastSentAt.getTime();
            if (elapsedMs < RESEND_DEBOUNCE_MS) {
                return {
                    status: "throttled",
                    retryAfterSec: Math.ceil(
                        (RESEND_DEBOUNCE_MS - elapsedMs) / 1000
                    ),
                };
            }
        }

        const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
        await this.emailVerificationRepository.upsert({
            groupId,
            email: target,
            code,
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
        });

        const link = `${process.env.FRAK_WALLET_URL}/profile/verify-email#code=${code}`;
        const { subject, html } = buildVerificationEmail({ code, link });
        await this.emailSender.send({ to: target, subject, html });

        log.info({ groupId }, "Email verification code sent");
        return { status: "sent" };
    }

    async verifyCode({
        groupId,
        code,
    }: {
        groupId: string;
        code: string;
    }): Promise<VerifyCodeResult> {
        const row = await this.emailVerificationRepository.findByGroup(groupId);
        if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
            return { status: "expired" };
        }
        if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
            return { status: "tooManyAttempts" };
        }
        if (row.code !== code) {
            await this.emailVerificationRepository.incrementAttempts(groupId);
            return { status: "invalid" };
        }

        await this.identityRepository.markEmailVerified(groupId, row.email);
        await this.identityRepository.unlinkOtherActiveEmails(
            groupId,
            row.email
        );
        await this.emailVerificationRepository.consume(groupId);

        log.info({ groupId }, "Email verified");
        return {
            status: "verified",
            email: row.email,
            verifiedAt: new Date().toISOString(),
        };
    }

    private async resolveTarget(
        groupId: string,
        email?: string
    ): Promise<string> {
        if (email) {
            const target = email.trim().toLowerCase();
            await this.identityRepository.addNode({
                groupId,
                type: "email",
                value: target,
            });
            return target;
        }

        const status =
            await this.identityRepository.findEmailStatusForGroup(groupId);
        const resolved = status.pendingEmail ?? status.email;
        if (!resolved) {
            throw HttpError.notFound("NO_EMAIL", "No email to verify");
        }
        return resolved;
    }
}
