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
