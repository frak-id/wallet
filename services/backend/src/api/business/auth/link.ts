import { rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, isUniqueViolation, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { StepUpRequired401 } from "../middleware/session";
import { assertStepUpFresh, requireDbSession, verifySiweProof } from "./common";

/**
 * Credential linking — sensitive: requires a fresh step-up (§4.8).
 */
export const linkRoutes = new Elysia({ prefix: "/link" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/wallet",
        async ({ body: { message, signature }, headers, request }) => {
            const auth = await requireDbSession(headers);
            await assertStepUpFresh(auth);

            const proof = await verifySiweProof({
                message,
                signature,
                origin: request.headers.get("origin") ?? "",
                requireFreshness: true,
            });
            if ("error" in proof) {
                return status(400, proof.error);
            }

            const result =
                await BusinessAuthContext.services.account.linkWallet({
                    accountId: auth.accountId,
                    wallet: proof.address,
                });
            if (result.status === "walletTaken") {
                throw HttpError.conflict(
                    "WALLET_TAKEN",
                    "This wallet is already linked to another account"
                );
            }

            return { linked: true as const, wallet: proof.address };
        },
        {
            body: t.Object({
                message: t.String(),
                signature: t.Hex(),
            }),
            response: {
                200: t.Object({
                    linked: t.Literal(true),
                    wallet: t.Address(),
                }),
                400: t.String(),
                401: StepUpRequired401,
                409: t.ErrorResponse,
            },
        }
    )
    .post(
        "/password",
        async ({ body: { email, password }, headers }) => {
            const auth = await requireDbSession(headers);
            await assertStepUpFresh(auth);

            if (
                !BusinessAuthContext.services.password.isValidPassword(password)
            ) {
                throw HttpError.badRequest(
                    "WEAK_PASSWORD",
                    "Password must be at least 10 characters"
                );
            }

            const account =
                await BusinessAuthContext.repositories.account.findById(
                    auth.accountId
                );
            if (!account) {
                throw HttpError.notFound("NO_ACCOUNT", "Account not found");
            }
            if (account.passwordHash) {
                throw HttpError.conflict(
                    "PASSWORD_EXISTS",
                    "This account already has a password"
                );
            }

            const normalizedEmail = email.trim().toLowerCase();
            if (!account.email) {
                const emailOwner =
                    await BusinessAuthContext.repositories.account.findByEmail(
                        normalizedEmail
                    );
                if (emailOwner) {
                    throw HttpError.conflict(
                        "EMAIL_TAKEN",
                        "This email is already used by another account"
                    );
                }
                try {
                    await BusinessAuthContext.repositories.account.setEmail(
                        auth.accountId,
                        normalizedEmail
                    );
                } catch (error) {
                    // The findByEmail check above is TOCTOU-racy: a concurrent
                    // link can claim the email between it and this UPDATE, so
                    // the partial unique index is the real arbiter — surface it
                    // as the same 409 instead of a raw 500 (§2.1).
                    if (isUniqueViolation(error)) {
                        throw HttpError.conflict(
                            "EMAIL_TAKEN",
                            "This email is already used by another account"
                        );
                    }
                    throw error;
                }
            } else if (account.email !== normalizedEmail) {
                throw HttpError.badRequest(
                    "EMAIL_MISMATCH",
                    "Email does not match the account email"
                );
            }

            const passwordHash =
                await BusinessAuthContext.services.password.hash(password);
            await BusinessAuthContext.repositories.account.setPasswordHash({
                accountId: auth.accountId,
                passwordHash,
            });

            // Prove ownership of a newly-attached email.
            if (!account.email) {
                await BusinessAuthContext.services.emailOtp.sendCode({
                    accountId: auth.accountId,
                    email: normalizedEmail,
                    purpose: "email_verify",
                });
            }

            return { linked: true as const };
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String(),
            }),
            response: {
                200: t.Object({ linked: t.Literal(true) }),
                400: t.ErrorResponse,
                401: StepUpRequired401,
                404: t.ErrorResponse,
                409: t.ErrorResponse,
            },
        }
    );
