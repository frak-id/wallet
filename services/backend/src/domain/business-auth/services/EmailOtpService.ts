import { log } from "@backend-infrastructure";
import { constantTimeStringEqual, HttpError, sha256Hex } from "@backend-utils";
import {
    buildSecurityCodeEmail,
    resendClient,
} from "../../../infrastructure/integrations/email";
import type { BusinessEmailCodePurpose } from "../db/schema";
import type { BusinessEmailCodeRepository } from "../repositories/BusinessEmailCodeRepository";

export const EMAIL_OTP = {
    CODE_TTL_MS: 10 * 60_000,
    RESEND_DEBOUNCE_MS: 60_000,
    MAX_VERIFY_ATTEMPTS: 5,
    SEND_WINDOW_MS: 60 * 60_000,
    MAX_SENDS_PER_WINDOW: 5,
} as const;

type SendOtpResult =
    | { status: "sent" }
    | { status: "throttled"; retryAfterSec: number };

type VerifyOtpResult =
    | { status: "verified" }
    | { status: "invalid" }
    | { status: "expired" }
    | { status: "tooManyAttempts" };

const PURPOSE_INTENT: Record<
    BusinessEmailCodePurpose,
    | "sign in"
    | "confirm a sensitive action"
    | "verify your email"
    | "reset your password"
> = {
    second_factor: "confirm a sensitive action",
    email_verify: "verify your email",
    password_reset: "reset your password",
};

/**
 * Deep link that prefills the code on the dashboard. The code rides in the URL
 * fragment (never sent to the server). Only the purposes with a landing page
 * that consumes it get a link:
 *  - `email_verify` → the standalone verify-email page (works on any logged-in
 *    session, e.g. the add-email flow).
 *  - `second_factor` → the pending-login completion screen; only usable in the
 *    same browser (the pending session lives in that tab), falls back to manual
 *    entry otherwise.
 * `password_reset` has no link yet (its landing flow isn't built).
 */
function buildCodeLink(
    purpose: BusinessEmailCodePurpose,
    code: string
): string | undefined {
    const base = process.env.BUSINESS_URL;
    if (!base) return undefined;
    if (purpose === "email_verify") {
        return `${base}/verify-email#code=${code}`;
    }
    if (purpose === "second_factor") {
        return `${base}/login/2fa#code=${code}`;
    }
    return undefined;
}

/**
 * Email OTP challenges for business accounts — mirrors the identity domain's
 * `EmailVerificationService` hardening (attempts cap, resend debounce, TTL)
 * with the code additionally hashed at rest, and sent from the dedicated
 * security address.
 */
export class EmailOtpService {
    constructor(
        private readonly emailCodeRepository: BusinessEmailCodeRepository
    ) {}

    private hashCode(code: string): string {
        // Codes are always `[0-9]{6}` — no case to fold, so `.trim()` alone.
        return sha256Hex(code.trim());
    }

    private generateCode(): string {
        // 6-digit numeric code, CSPRNG, no modulo bias concern at this size
        // (2^32 % 10^6 bias is < 0.0001% — irrelevant for a 5-attempt cap).
        const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
        return value.toString().padStart(6, "0");
    }

    async sendCode(params: {
        accountId: string;
        email: string;
        purpose: BusinessEmailCodePurpose;
    }): Promise<SendOtpResult> {
        // Debounce first — before any side effect.
        const existing = await this.emailCodeRepository.find(
            params.accountId,
            params.purpose
        );
        if (existing) {
            const elapsedMs = Date.now() - existing.lastSentAt.getTime();
            if (elapsedMs < EMAIL_OTP.RESEND_DEBOUNCE_MS) {
                return {
                    status: "throttled",
                    retryAfterSec: Math.ceil(
                        (EMAIL_OTP.RESEND_DEBOUNCE_MS - elapsedMs) / 1000
                    ),
                };
            }
        }

        // Hourly send-rate cap: rolling window carried on the row itself (no
        // extra table) — reset once the window has elapsed, otherwise reject
        // once MAX_SENDS_PER_WINDOW is hit.
        const now = Date.now();
        const windowStartedAt =
            existing &&
            now - existing.sendWindowStartedAt.getTime() <
                EMAIL_OTP.SEND_WINDOW_MS
                ? existing.sendWindowStartedAt
                : new Date(now);
        const sendCountInWindow =
            windowStartedAt === existing?.sendWindowStartedAt
                ? existing.sendCount
                : 0;
        if (sendCountInWindow >= EMAIL_OTP.MAX_SENDS_PER_WINDOW) {
            return {
                status: "throttled",
                retryAfterSec: Math.ceil(
                    (EMAIL_OTP.SEND_WINDOW_MS -
                        (now - windowStartedAt.getTime())) /
                        1000
                ),
            };
        }

        const code = this.generateCode();
        const { subject, html } = buildSecurityCodeEmail({
            code,
            intent: PURPOSE_INTENT[params.purpose],
            link: buildCodeLink(params.purpose, code),
        });

        // Send BEFORE persisting: a failed send must not stamp `lastSentAt`
        // (which would wrongly throttle the user's immediate retry).
        try {
            await resendClient.send({
                to: params.email,
                subject,
                html,
                from: process.env.RESEND_SECURITY_FROM_EMAIL,
            });
        } catch (err) {
            log.error(
                { accountId: params.accountId, err },
                "Failed to send business auth OTP"
            );
            throw new HttpError({
                status: 502,
                code: "EMAIL_SEND_FAILED",
                message: "Could not send the security code email",
            });
        }

        await this.emailCodeRepository.upsert({
            accountId: params.accountId,
            purpose: params.purpose,
            codeHash: this.hashCode(code),
            expiresAt: new Date(Date.now() + EMAIL_OTP.CODE_TTL_MS),
            sendCount: sendCountInWindow + 1,
            sendWindowStartedAt: windowStartedAt,
        });

        log.info(
            { accountId: params.accountId, purpose: params.purpose },
            "Business auth OTP sent"
        );
        return { status: "sent" };
    }

    async verifyCode(params: {
        accountId: string;
        purpose: BusinessEmailCodePurpose;
        code: string;
    }): Promise<VerifyOtpResult> {
        const row = await this.emailCodeRepository.find(
            params.accountId,
            params.purpose
        );
        if (!row || row.consumedAt) {
            return { status: "expired" };
        }
        if (row.expiresAt.getTime() < Date.now()) {
            return { status: "expired" };
        }
        if (row.attempts >= EMAIL_OTP.MAX_VERIFY_ATTEMPTS) {
            return { status: "tooManyAttempts" };
        }
        const isMatch = constantTimeStringEqual(
            row.codeHash,
            this.hashCode(params.code)
        );
        if (!isMatch) {
            await this.emailCodeRepository.incrementAttempts(
                params.accountId,
                params.purpose
            );
            return { status: "invalid" };
        }

        await this.emailCodeRepository.consume(
            params.accountId,
            params.purpose
        );
        return { status: "verified" };
    }
}
