import { log, rateLimitMiddleware } from "@backend-infrastructure";
import {
    HttpError,
    isUniqueViolation,
    TwoFactorMethodDto,
    t,
} from "@backend-utils";
import { Elysia, status } from "elysia";
import { BusinessAuthResponseDto } from "../../../domain/auth";
import {
    type BusinessAccountSelect,
    BusinessAuthContext,
    isCredentialLessAccount,
} from "../../../domain/business-auth";
import { resolveClientIp, verifySiweProof } from "./common";

/**
 * Password reset is also the self-service unbrick for a merchant-team
 * invitation whose link expired: the account exists (created by the invite)
 * but has no password yet. The OTP round-trip proves mailbox ownership just
 * as much as a fresh registration would, so it's safe to let it set the
 * first password here too — this must NOT extend to `/register`, which stays
 * a no-op on an existing row (an attacker guessing the invited email must
 * not be able to burn the invite by registering first).
 */
function canReceiveResetCode(account: BusinessAccountSelect): boolean {
    return !!account.passwordHash || isCredentialLessAccount(account);
}

/**
 * Fire-and-forget the reset OTP on the enumeration-safe request endpoint.
 * Awaiting the Resend round-trip (tens–hundreds of ms) only on the
 * account-exists branch is a timing oracle that defeats the
 * identical-response-body guarantee — so the send happens off the request
 * path and failures are only logged (the user can always re-request).
 */
function sendResetOtpOffPath(params: {
    accountId: string;
    email: string;
}): void {
    BusinessAuthContext.services.emailOtp
        .sendCode({ ...params, purpose: "password_reset" })
        .catch((error) => log.error({ error }, "Reset OTP send failed"));
}

const GENERIC_REGISTER_RESPONSE = {
    message:
        "If this email was available, the account has been created — sign in to continue",
} as const;

const GENERIC_RESET_RESPONSE = {
    message: "If an account exists for this email, a reset code has been sent",
} as const;

export const loginRoutes = new Elysia()
    .use(
        rateLimitMiddleware({
            bucket: "business-auth-login",
            windowMs: 60_000,
            maxRequests: 10,
        })
    )
    .post(
        "/login",
        async ({ body: { message, signature }, request, headers, server }) => {
            const proof = await verifySiweProof({
                message,
                signature,
                origin: request.headers.get("origin") ?? "",
                requireFreshness: true,
            });
            if ("error" in proof) {
                return status(400, proof.error);
            }

            // Idempotent account upsert: the wallet becomes (or already is) a
            // credential of a business account.
            const account =
                await BusinessAuthContext.services.account.upsertWalletAccount(
                    proof.address
                );

            // Passkey ceremony counts as inherent MFA — the session starts
            // 2FA-verified (opens the 5-minute step-up window).
            const { token, session } =
                await BusinessAuthContext.services.session.create({
                    accountId: account.id,
                    authMethod: "siwe",
                    twoFactorVerified: true,
                    ip: resolveClientIp({ request, headers, server }),
                    userAgent: request.headers.get("user-agent") ?? undefined,
                });

            return {
                token,
                wallet: proof.address,
                expiresAt: session.expiresAt.getTime(),
            };
        },
        {
            body: t.Object({
                message: t.String(),
                signature: t.Hex(),
            }),
            response: {
                200: BusinessAuthResponseDto,
                400: t.String(),
            },
        }
    )
    .post(
        "/register",
        async ({ body: { email, password } }) => {
            BusinessAuthContext.services.password.assertValid(password);

            const normalizedEmail = email.trim().toLowerCase();

            // Hash unconditionally, before the existence check: an
            // already-registered email must burn the exact same argon2id
            // cost as a fresh registration, otherwise the branch that
            // short-circuits before hashing is a timing oracle for account
            // enumeration.
            const passwordHash =
                await BusinessAuthContext.services.password.hash(password);

            const existing =
                await BusinessAuthContext.repositories.account.findByEmail(
                    normalizedEmail
                );
            // Enumeration-safe: an already-registered email returns the same
            // generic response, and no email is sent to it. The hash computed
            // above is simply discarded in this branch.
            if (existing) {
                return GENERIC_REGISTER_RESPONSE;
            }

            let account: { id: string };
            try {
                account = await BusinessAuthContext.repositories.account.create(
                    { email: normalizedEmail }
                );
            } catch (error) {
                // The findByEmail check above is TOCTOU-racy: a concurrent
                // register can win the partial unique index between it and
                // this INSERT. The loser must return the same generic
                // response — a raw 500 here would itself be an enumeration
                // side-channel (200/200 vs 200/500 on a double submit).
                if (isUniqueViolation(error)) {
                    return GENERIC_REGISTER_RESPONSE;
                }
                throw error;
            }
            await BusinessAuthContext.repositories.account.setPasswordHash({
                accountId: account.id,
                passwordHash,
            });

            // No verification email here: the first password login requires
            // email 2FA anyway (`/2fa/verify` marks the email verified), so a
            // register-time code would be a second, orphaned email — nothing
            // in the login flow consumes it.
            return GENERIC_REGISTER_RESPONSE;
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String(),
            }),
            response: {
                200: t.Object({ message: t.String() }),
                400: t.ErrorResponse,
            },
        }
    )
    .post(
        // Forgotten-password recovery, step 1 (§P1): mail a single-use OTP to a
        // password account. Enumeration-safe — the response is identical
        // whether or not the email maps to a password account, and no code is
        // sent otherwise (SSO-only accounts add a password through the
        // authenticated `link/password` step-up instead).
        "/password/reset/request",
        async ({ body: { email } }) => {
            const normalizedEmail = email.trim().toLowerCase();
            const account =
                await BusinessAuthContext.repositories.account.findByEmail(
                    normalizedEmail
                );
            if (account && canReceiveResetCode(account)) {
                sendResetOtpOffPath({
                    accountId: account.id,
                    email: normalizedEmail,
                });
            }
            return GENERIC_RESET_RESPONSE;
        },
        {
            body: t.Object({ email: t.String({ format: "email" }) }),
            response: { 200: t.Object({ message: t.String() }) },
        }
    )
    .post(
        // Forgotten-password recovery, step 2 (§P1): verify the OTP and set the
        // new password. A wrong code, an unknown email, and an SSO-only
        // account all collapse to the same `INVALID_CODE` so the endpoint
        // can't confirm which emails exist. The OTP proves email ownership,
        // so a successful reset also marks the email verified.
        "/password/reset/confirm",
        async ({ body: { email, code, password } }) => {
            BusinessAuthContext.services.password.assertValid(password);

            const normalizedEmail = email.trim().toLowerCase();
            const account =
                await BusinessAuthContext.repositories.account.findByEmail(
                    normalizedEmail
                );
            if (!account || !canReceiveResetCode(account)) {
                throw HttpError.badRequest(
                    "INVALID_CODE",
                    "Invalid or expired code"
                );
            }

            const result =
                await BusinessAuthContext.services.emailOtp.verifyCode({
                    accountId: account.id,
                    purpose: "password_reset",
                    code,
                });
            if (result.status !== "verified") {
                throw HttpError.badRequest(
                    "INVALID_CODE",
                    "Invalid or expired code"
                );
            }

            const passwordHash =
                await BusinessAuthContext.services.password.hash(password);
            await BusinessAuthContext.repositories.account.setPasswordHash({
                accountId: account.id,
                passwordHash,
            });
            await BusinessAuthContext.repositories.account.markEmailVerified(
                account.id
            );
            // Credential-reset hygiene: any session established with the old
            // (possibly compromised) password must not survive the recovery.
            await BusinessAuthContext.repositories.session.revokeAllForAccount(
                account.id
            );

            return { success: true as const };
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                code: t.String(),
                password: t.String(),
            }),
            response: {
                200: t.Object({ success: t.Literal(true) }),
                400: t.ErrorResponse,
            },
        }
    )
    .post(
        "/login/password",
        async ({ body: { email, password }, request, headers, server }) => {
            const account =
                await BusinessAuthContext.repositories.account.findByEmail(
                    email.trim().toLowerCase()
                );

            // Constant-work verification whether or not the email exists.
            const valid =
                await BusinessAuthContext.services.password.verifyOrDummy(
                    password,
                    account?.passwordHash
                );
            if (!valid || !account) {
                return status(401, "Invalid credentials");
            }

            // Pending session: unusable outside /auth until 2FA completes.
            const { token, session } =
                await BusinessAuthContext.services.session.create({
                    accountId: account.id,
                    authMethod: "password",
                    ip: resolveClientIp({ request, headers, server }),
                    userAgent: request.headers.get("user-agent") ?? undefined,
                });

            const methods =
                await BusinessAuthContext.services.account.getEnabledTwoFactorMethods(
                    account.id
                );

            return {
                token,
                pending2fa: true as const,
                methods,
                expiresAt: session.expiresAt.getTime(),
            };
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String(),
            }),
            response: {
                200: t.Object({
                    token: t.String(),
                    pending2fa: t.Literal(true),
                    methods: t.Array(TwoFactorMethodDto),
                    expiresAt: t.Number(),
                }),
                401: t.String(),
            },
        }
    );
