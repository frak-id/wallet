import { rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { encodeBase64urlNoPadding } from "@oslojs/encoding";
import { Elysia, status } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { requireDbSession, verifySiweProof } from "./common";

const TwoFactorMethodDto = t.Union([
    t.Literal("email"),
    t.Literal("totp"),
    t.Literal("siwe"),
]);

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
    .post(
        "/challenge",
        async ({ body: { method }, headers }) => {
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });

            switch (method) {
                case "email": {
                    const account =
                        await BusinessAuthContext.repositories.account.findById(
                            auth.accountId
                        );
                    if (!account?.email) {
                        throw HttpError.badRequest(
                            "NO_EMAIL",
                            "No email on this account"
                        );
                    }
                    const result =
                        await BusinessAuthContext.services.emailOtp.sendCode({
                            accountId: auth.accountId,
                            email: account.email,
                            purpose: "second_factor",
                        });
                    if (result.status === "throttled") {
                        throw HttpError.tooManyRequests(
                            "OTP_THROTTLED",
                            `Retry in ${result.retryAfterSec}s`
                        );
                    }
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
                return status(401, "Invalid proof");
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
                401: t.Union([t.String(), t.ErrorResponse]),
            },
        }
    )
    .post(
        "/setup",
        async ({ body: { method }, headers }) => {
            const auth = await requireDbSession(headers);
            await requireStepUpUnlessBootstrap(auth.accountId, auth);

            switch (method) {
                case "totp": {
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
                    return {
                        otpauthUri: setup.otpauthUri,
                        qrSvg: setup.qrSvg,
                    };
                }
                case "email": {
                    const account =
                        await BusinessAuthContext.repositories.account.findById(
                            auth.accountId
                        );
                    if (!account?.email) {
                        throw HttpError.badRequest(
                            "NO_EMAIL",
                            "Set an email on the account first"
                        );
                    }
                    const result =
                        await BusinessAuthContext.services.emailOtp.sendCode({
                            accountId: auth.accountId,
                            email: account.email,
                            purpose: "email_verify",
                        });
                    if (result.status === "throttled") {
                        throw HttpError.tooManyRequests(
                            "OTP_THROTTLED",
                            `Retry in ${result.retryAfterSec}s`
                        );
                    }
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
                    qrSvg: t.Optional(t.String()),
                    status: t.Optional(t.Literal("sent")),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
                429: t.ErrorResponse,
            },
        }
    )
    .post(
        "/activate",
        async ({ body: { method, proof }, headers }) => {
            const auth = await requireDbSession(headers);

            switch (method) {
                case "totp": {
                    const result =
                        await BusinessAuthContext.services.totp.activate({
                            accountId: auth.accountId,
                            code: proof,
                        });
                    if (!result) {
                        return status(401, "Invalid code");
                    }
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
                        return status(401, "Invalid code");
                    }
                    await BusinessAuthContext.repositories.account.markEmailVerified(
                        auth.accountId
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
                401: t.Union([t.String(), t.ErrorResponse]),
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
            const wallet = await BusinessAuthContext.services.account.getWallet(
                auth.accountId
            );
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

/**
 * `2fa/setup` bootstrap rule: a brand-new account with zero usable methods
 * must be able to enroll its first one; once any method exists, changing
 * enrollment is a sensitive action requiring fresh step-up.
 */
async function requireStepUpUnlessBootstrap(
    accountId: string,
    auth: SessionAuth
): Promise<void> {
    const methods =
        await BusinessAuthContext.services.account.getEnabledTwoFactorMethods(
            accountId
        );
    if (methods.length === 0) return;

    const fresh = BusinessAuthContext.services.session.isStepUpFresh({
        twoFactorVerifiedAt: auth.twoFactorVerifiedAt,
    });
    if (!fresh) {
        throw HttpError.unauthorized(
            "STEP_UP_REQUIRED",
            "Fresh two-factor verification required"
        );
    }
}
