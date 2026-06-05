import { db, log } from "@backend-infrastructure";
import { generateCode, HttpError } from "@backend-utils";
import { EMAIL_VERIFICATION } from "@frak-labs/app-essentials/constants/emailVerification";
import { buildVerificationEmail } from "../../../infrastructure/integrations/email";
import type { EmailVerificationCodeSelect } from "../db/schema";
import type { EmailVerificationRepository } from "../repositories/EmailVerificationRepository";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { EmailSender } from "./EmailSender";

export type SendCodeResult =
    | { status: "sent" }
    | { status: "throttled"; retryAfterSec: number };

export type VerifyCodeResult =
    | { status: "verified"; email: string; verifiedAt: string }
    | { status: "alreadyVerified"; email: string }
    // The address was claimed by another identity group between send and
    // verify — the route enriches this into the merge-capable conflict payload.
    | { status: "conflict"; email: string }
    | { status: "invalid" }
    | { status: "expired" }
    | { status: "tooManyAttempts" };

export type EmailStatus = {
    email: string | null;
    verifiedAt: Date | null;
    pendingEmail: string | null;
};

export class EmailVerificationService {
    constructor(
        private readonly emailVerificationRepository: EmailVerificationRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly emailSender: EmailSender
    ) {}

    /**
     * Resolve a group's email status for the wallet UI: the current address +
     * its verification stamp, plus any rotation address currently in flight.
     * The pending address lives only on the active challenge row (a rotation
     * target is never an identity node until its code is entered), so it is
     * sourced here rather than from the identity graph.
     */
    async getEmailStatus(groupId: string): Promise<EmailStatus> {
        const status =
            await this.identityRepository.findEmailStatusForGroup(groupId);
        const challenge =
            await this.emailVerificationRepository.findByGroup(groupId);

        const isActiveChallenge =
            !!challenge &&
            !challenge.consumedAt &&
            challenge.expiresAt.getTime() > Date.now();
        const pendingEmail =
            isActiveChallenge && challenge.email !== status.email
                ? challenge.email
                : null;

        return {
            email: status.email,
            verifiedAt: status.verifiedAt,
            pendingEmail,
        };
    }

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
            if (elapsedMs < EMAIL_VERIFICATION.RESEND_DEBOUNCE_MS) {
                return {
                    status: "throttled",
                    retryAfterSec: Math.ceil(
                        (EMAIL_VERIFICATION.RESEND_DEBOUNCE_MS - elapsedMs) /
                            1000
                    ),
                };
            }
        }

        const target = await this.resolveTarget({ groupId, email, existing });
        const code = generateCode();
        const link = `${process.env.FRAK_WALLET_URL}/profile/verify-email#code=${code}`;
        const { subject, html } = buildVerificationEmail({ code, link });

        // Send BEFORE persisting: a failed send must not stamp `lastSentAt`
        // (which would wrongly throttle the user's immediate retry) nor leave
        // an undelivered code on the row. Only once the provider accepts the
        // message do we upsert the challenge + reset the debounce window.
        try {
            await this.emailSender.send({ to: target, subject, html });
        } catch (err) {
            log.error(
                { groupId, err },
                "Failed to send email verification code"
            );
            throw new HttpError({
                status: 502,
                code: "EMAIL_SEND_FAILED",
                message: "Could not send the verification email",
            });
        }

        await this.emailVerificationRepository.upsert({
            groupId,
            email: target,
            code,
            expiresAt: new Date(Date.now() + EMAIL_VERIFICATION.CODE_TTL_MS),
        });

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
        if (!row) {
            return { status: "expired" };
        }
        if (row.consumedAt) {
            return { status: "alreadyVerified", email: row.email };
        }
        if (row.expiresAt.getTime() < Date.now()) {
            return { status: "expired" };
        }
        if (row.attempts >= EMAIL_VERIFICATION.MAX_VERIFY_ATTEMPTS) {
            return { status: "tooManyAttempts" };
        }
        if (row.code !== code.trim().toUpperCase()) {
            await this.emailVerificationRepository.incrementAttempts(groupId);
            return { status: "invalid" };
        }

        // Attach + retire previous emails + consume the challenge atomically:
        // a partial commit could either leave the code replayable or strand the
        // group with two active emails masking the freshly-verified one.
        const verifiedAt = new Date();
        let attached = false;
        await db.transaction(async (tx) => {
            attached = await this.identityRepository.attachVerifiedEmail(
                groupId,
                row.email,
                tx
            );
            // Address owned by another group (race between send and verify):
            // `attachVerifiedEmail` wrote nothing, so this commits as a no-op
            // and we surface a conflict rather than a phantom "verified".
            if (!attached) return;
            await this.identityRepository.unlinkOtherActiveEmails(
                groupId,
                row.email,
                tx
            );
            await this.emailVerificationRepository.consume(groupId, tx);
        });

        if (!attached) {
            log.warn(
                { groupId },
                "Email verification lost the attach race (owned by another group)"
            );
            return { status: "conflict", email: row.email };
        }

        log.info({ groupId }, "Email verified");
        return {
            status: "verified",
            email: row.email,
            verifiedAt: verifiedAt.toISOString(),
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
