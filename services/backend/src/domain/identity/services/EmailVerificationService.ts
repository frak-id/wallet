import { randomInt } from "node:crypto";
import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildVerificationEmail } from "../../../infrastructure/integrations/email";
import type { EmailVerificationCodeSelect } from "../db/schema";
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
        // Debounce first — before any side effect — so a throttled resend never
        // touches the identity graph or the challenge row.
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

        const target = await this.resolveTarget({ groupId, email, existing });

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

        // Attach the now-proven address as the group's verified email. Only
        // retire the previous active email(s) once the attach succeeds, so a
        // lost cross-group race (the address verified elsewhere between send
        // and verify) can never wipe the user's current email.
        const attached = await this.identityRepository.attachVerifiedEmail(
            groupId,
            row.email
        );
        if (attached) {
            await this.identityRepository.unlinkOtherActiveEmails(
                groupId,
                row.email
            );
        } else {
            log.warn(
                { groupId },
                "Email verified but not attached (already owned by another group)"
            );
        }
        await this.emailVerificationRepository.consume(groupId);

        log.info({ groupId }, "Email verified");
        return {
            status: "verified",
            email: row.email,
            verifiedAt: new Date().toISOString(),
        };
    }

    private async resolveTarget({
        groupId,
        email,
        existing,
    }: {
        groupId: string;
        email?: string;
        existing: EmailVerificationCodeSelect | null;
    }): Promise<string> {
        // Rotation: a new address is only proven once the code is entered, so
        // it is NOT attached as an identity node here — it lives on the
        // challenge row until `verifyCode` attaches it. Keeps unverified
        // addresses out of the identity graph (no squatting, no orphan nodes).
        if (email) {
            return email.trim().toLowerCase();
        }

        // Resend with no explicit address: prefer an in-flight challenge's
        // target (a rotation whose code hasn't been entered yet lives only on
        // the challenge row), otherwise fall back to the group's current email.
        if (
            existing &&
            !existing.consumedAt &&
            existing.expiresAt.getTime() > Date.now()
        ) {
            return existing.email;
        }

        const status =
            await this.identityRepository.findEmailStatusForGroup(groupId);
        if (!status.email) {
            throw HttpError.notFound("NO_EMAIL", "No email to verify");
        }
        return status.email;
    }
}
