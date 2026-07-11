import { rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, TwoFactorMethodDto, t } from "@backend-utils";
import { encodeBase64urlNoPadding } from "@oslojs/encoding";
import { Elysia } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";
import type { BusinessEmailCodePurpose } from "../../../domain/business-auth/db/schema";
import { StepUpRequired401 } from "../middleware/session";
import { assertStepUpFresh, requireDbSession, verifySiweProof } from "./common";

/**
 * Send an email OTP for `accountId`, or throw the appropriate typed error
 * (S2 — previously duplicated between `/challenge` and `/setup`). The account
 * must already carry an email; a send-rate hit surfaces as a 429.
 */
async function sendEmailOtpOrThrow(params: {
    accountId: string;
    purpose: BusinessEmailCodePurpose;
    noEmailMessage: string;
}): Promise<void> {
    const account = await BusinessAuthContext.repositories.account.findById(
        params.accountId
    );
    if (!account?.email) {
        throw HttpError.badRequest("NO_EMAIL", params.noEmailMessage);
    }
    const result = await BusinessAuthContext.services.emailOtp.sendCode({
        accountId: params.accountId,
        email: account.email,
        purpose: params.purpose,
    });
    if (result.status === "throttled") {
        throw HttpError.tooManyRequests(
            "OTP_THROTTLED",
            `Retry in ${result.retryAfterSec}s`
        );
    }
}

const SiweProofDto = t.Object({
    message: t.String(),
    signature: t.Hex(),
});

/**
 * Method-generic 2FA surface (§4.6): one challenge endpoint, one verify
 * endpoint. Verifying always sets `two_factor_verified_at = now()` — which
 * both completes a pending login AND refreshes the 5-minute step-up window.
 */
export const twoFactorRoutes = new Elysia({ prefix: "/2fa" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 15 }))
    .get(
        "/methods",
        async ({ headers }) => {
            // Works on pending sessions so the login 2FA screen can fetch the
            // real enrolled list instead of guessing, and on full sessions so
            // the settings UI knows which methods are already enrolled.
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });
            const methods =
                await BusinessAuthContext.services.account.getEnabledTwoFactorMethods(
                    auth.accountId
                );
            return { methods };
        },
        {
            response: {
                200: t.Object({ methods: t.Array(TwoFactorMethodDto) }),
                401: t.ErrorResponse,
            },
        }
    )
    .post(
        "/challenge",
        async ({ body: { method }, headers }) => {
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });

            switch (method) {
                case "email": {
                    await sendEmailOtpOrThrow({
                        accountId: auth.accountId,
                        purpose: "second_factor",
                        noEmailMessage: "No email on this account",
                    });
                    return { status: "sent" as const };
                }
                case "totp":
                    // Nothing to send — the client's authenticator app has
                    // the code.
                    return { status: "ready" as const };
                case "siwe": {
                    const nonce = encodeBase64urlNoPadding(
                        crypto.getRandomValues(new Uint8Array(16))
                    );
                    await BusinessAuthContext.repositories.session.setTwoFactorNonce(
                        auth.sessionId,
                        nonce
                    );
                    return { status: "ready" as const, nonce };
                }
            }
        },
        {
            body: t.Object({ method: TwoFactorMethodDto }),
            response: {
                200: t.Object({
                    status: t.Union([t.Literal("sent"), t.Literal("ready")]),
                    nonce: t.Optional(t.String()),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
                429: t.ErrorResponse,
            },
        }
    )
    .post(
        "/verify",
        async ({ body, headers, request }) => {
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });

            const verified = await verifyProof({
                auth,
                body,
                origin: request.headers.get("origin") ?? "",
            });
            if (!verified) {
                // A wrong proof is a *validation* failure, not a dead
                // session: throw a typed 401 so the frontend surfaces it
                // without logging the user out (mirrored in
                // `apps/business` `backendClient` 401 handler).
                throw HttpError.unauthorized(
                    "INVALID_TWO_FACTOR_PROOF",
                    "Invalid proof"
                );
            }

            await BusinessAuthContext.services.session.markTwoFactorVerified(
                auth.sessionId
            );

            // First successful email 2FA doubles as the email ownership proof.
            if (body.method === "email") {
                await BusinessAuthContext.repositories.account.markEmailVerified(
                    auth.accountId
                );
            }

            return { verified: true as const };
        },
        {
            body: t.Union([
                t.Object({
                    method: t.Union([t.Literal("email"), t.Literal("totp")]),
                    proof: t.String(),
                }),
                t.Object({
                    method: t.Literal("siwe"),
                    proof: SiweProofDto,
                }),
            ]),
            response: {
                200: t.Object({ verified: t.Literal(true) }),
                401: t.ErrorResponse,
                429: t.ErrorResponse,
            },
        }
    )
    .post(
        "/setup",
        async ({ body: { method }, headers }) => {
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });

            switch (method) {
                case "totp": {
                    // Minting a new authenticator secret is sensitive — gate
                    // it on a fresh step-up (a Shopify-SSO/password account
                    // stuck pending with zero 2FA methods may bootstrap its
                    // first one, `allowBootstrap`). Sending an email verify
                    // code (below) is NOT sensitive — same as `/2fa/challenge`,
                    // no step-up — so it must not sit here, or an email resend
                    // would pop a step-up modal and hang.
                    await assertStepUpFresh(auth, { allowBootstrap: true });
                    const account =
                        await BusinessAuthContext.repositories.account.findById(
                            auth.accountId
                        );
                    const setup = await BusinessAuthContext.services.totp.setup(
                        {
                            accountId: auth.accountId,
                            accountLabel:
                                account?.email ?? auth.wallet ?? auth.accountId,
                        }
                    );
                    return { otpauthUri: setup.otpauthUri };
                }
                case "email": {
                    await sendEmailOtpOrThrow({
                        accountId: auth.accountId,
                        purpose: "email_verify",
                        noEmailMessage: "Set an email on the account first",
                    });
                    return { status: "sent" as const };
                }
                case "siwe":
                    throw HttpError.badRequest(
                        "INVALID_METHOD",
                        "SIWE needs no enrollment — link a wallet instead"
                    );
            }
        },
        {
            body: t.Object({ method: TwoFactorMethodDto }),
            response: {
                200: t.Object({
                    otpauthUri: t.Optional(t.String()),
                    status: t.Optional(t.Literal("sent")),
                }),
                400: t.ErrorResponse,
                401: StepUpRequired401,
                429: t.ErrorResponse,
            },
        }
    )
    .post(
        "/activate",
        async ({ body: { method, proof }, headers }) => {
            // Pending allowed so bootstrap enrollment can complete (§1.4): a
            // valid activation code is itself a fresh 2FA proof, so on success
            // we stamp the session verified — the pending Shopify-SSO account
            // lands fully authenticated instead of stuck.
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });

            switch (method) {
                case "totp": {
                    const result =
                        await BusinessAuthContext.services.totp.activate({
                            accountId: auth.accountId,
                            code: proof,
                        });
                    if (!result) {
                        throw HttpError.unauthorized(
                            "INVALID_TWO_FACTOR_CODE",
                            "Invalid code"
                        );
                    }
                    await BusinessAuthContext.services.session.markTwoFactorVerified(
                        auth.sessionId
                    );
                    return { recoveryCodes: result.recoveryCodes };
                }
                case "email": {
                    const result =
                        await BusinessAuthContext.services.emailOtp.verifyCode({
                            accountId: auth.accountId,
                            purpose: "email_verify",
                            code: proof,
                        });
                    if (result.status !== "verified") {
                        throw HttpError.unauthorized(
                            "INVALID_TWO_FACTOR_CODE",
                            "Invalid code"
                        );
                    }
                    await BusinessAuthContext.repositories.account.markEmailVerified(
                        auth.accountId
                    );
                    await BusinessAuthContext.services.session.markTwoFactorVerified(
                        auth.sessionId
                    );
                    return { verified: true as const };
                }
                case "siwe":
                    throw HttpError.badRequest(
                        "INVALID_METHOD",
                        "SIWE needs no enrollment"
                    );
            }
        },
        {
            body: t.Object({
                method: TwoFactorMethodDto,
                proof: t.String(),
            }),
            response: {
                200: t.Object({
                    recoveryCodes: t.Optional(t.Array(t.String())),
                    verified: t.Optional(t.Literal(true)),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
            },
        }
    );

type SessionAuth = Awaited<ReturnType<typeof requireDbSession>>;

type VerifyBody =
    | { method: "email" | "totp"; proof: string }
    | { method: "siwe"; proof: { message: string; signature: `0x${string}` } };

async function verifyProof({
    auth,
    body,
    origin,
}: {
    auth: SessionAuth;
    body: VerifyBody;
    origin: string;
}): Promise<boolean> {
    switch (body.method) {
        case "email": {
            const result =
                await BusinessAuthContext.services.emailOtp.verifyCode({
                    accountId: auth.accountId,
                    purpose: "second_factor",
                    code: body.proof,
                });
            return result.status === "verified";
        }
        case "totp":
            return BusinessAuthContext.services.totp.verify({
                accountId: auth.accountId,
                code: body.proof,
            });
        case "siwe": {
            const proof = await verifySiweProof({
                message: body.proof.message,
                signature: body.proof.signature,
                origin,
            });
            if ("error" in proof) return false;

            // The signature must come from THIS account's wallet…
            const account =
                await BusinessAuthContext.repositories.account.findById(
                    auth.accountId
                );
            const wallet = account?.walletAddress ?? null;
            if (
                !wallet ||
                wallet.toLowerCase() !== proof.address.toLowerCase()
            ) {
                return false;
            }

            // …and echo the nonce issued for this session (anti-replay).
            const session =
                await BusinessAuthContext.repositories.session.findById(
                    auth.sessionId
                );
            if (!session?.twoFactorNonce) return false;
            return proof.nonce === session.twoFactorNonce;
        }
    }
}
