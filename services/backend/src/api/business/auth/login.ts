import { rateLimitMiddleware } from "@backend-infrastructure";
import { TwoFactorMethodDto, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { BusinessAuthResponseDto } from "../../../domain/auth";
import {
    BusinessAuthContext,
    PasswordService,
} from "../../../domain/business-auth";
import { resolveClientIp, verifySiweProof } from "./common";

const GENERIC_REGISTER_RESPONSE = {
    message: "If this email is not already registered, a code has been sent",
} as const;

const GENERIC_RESET_RESPONSE = {
    message: "If an account exists for this email, a reset code has been sent",
} as const;

export const loginRoutes = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
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
            if (
                !BusinessAuthContext.services.password.isValidPassword(password)
            ) {
                return status(400, {
                    error: "WEAK_PASSWORD",
                    message: `Password must be at least ${PasswordService.MIN_LENGTH} characters`,
                });
            }

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

            const account =
                await BusinessAuthContext.repositories.account.create({
                    email: normalizedEmail,
                });
            await BusinessAuthContext.repositories.account.setPasswordHash({
                accountId: account.id,
                passwordHash,
            });

            await BusinessAuthContext.services.emailOtp.sendCode({
                accountId: account.id,
                email: normalizedEmail,
                purpose: "email_verify",
            });

            return GENERIC_REGISTER_RESPONSE;
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String(),
            }),
            response: {
                200: t.Object({ message: t.String() }),
                400: t.Object({ error: t.String(), message: t.String() }),
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
            if (account?.passwordHash) {
                await BusinessAuthContext.services.emailOtp.sendCode({
                    accountId: account.id,
                    email: normalizedEmail,
                    purpose: "password_reset",
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
            if (
                !BusinessAuthContext.services.password.isValidPassword(password)
            ) {
                return status(400, {
                    error: "WEAK_PASSWORD",
                    message: `Password must be at least ${PasswordService.MIN_LENGTH} characters`,
                });
            }

            const normalizedEmail = email.trim().toLowerCase();
            const account =
                await BusinessAuthContext.repositories.account.findByEmail(
                    normalizedEmail
                );
            if (!account?.passwordHash) {
                return status(400, {
                    error: "INVALID_CODE",
                    message: "Invalid or expired code",
                });
            }

            const result =
                await BusinessAuthContext.services.emailOtp.verifyCode({
                    accountId: account.id,
                    purpose: "password_reset",
                    code,
                });
            if (result.status !== "verified") {
                return status(400, {
                    error: "INVALID_CODE",
                    message: "Invalid or expired code",
                });
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
                400: t.Object({ error: t.String(), message: t.String() }),
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
