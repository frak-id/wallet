import { JwtContext, rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import {
    BusinessAuthContext,
    inviterLabel,
    isCredentialLessAccount,
} from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import { resolveClientIp } from "./common";

const GENERIC_INVALID_TOKEN = () =>
    HttpError.badRequest(
        "INVALID_INVITATION",
        "This invitation link is invalid or has expired"
    );

/**
 * Resolve + validate an invitation token down to its account/merchant rows.
 * Shared by preview and claim so both apply the exact same acceptance rules
 * (enumeration-safe: any failure collapses to the same generic error).
 */
async function resolveInvitation(token: string) {
    const payload = await JwtContext.businessInvitation.verify(token);
    if (!payload) throw GENERIC_INVALID_TOKEN();

    const account = await BusinessAuthContext.repositories.account.findById(
        payload.sub
    );
    // Email mismatch is defense-in-depth only (a credential-less account's
    // email can't change today), but keep the check — cheap and correct.
    if (!account || account.email !== payload.email) {
        throw GENERIC_INVALID_TOKEN();
    }

    return { payload, account };
}

/**
 * Public, unauthenticated merchant-team invitation claim surface — the
 * landing page for the link mailed by `POST /business/merchant/:id/admins`.
 * Session-agnostic by design: never reads `x-business-auth`, so a stale
 * session in the same browser can't misdirect which account gets claimed.
 */
export const inviteRoutes = new Elysia({ prefix: "/invite" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/preview",
        async ({ body: { token } }) => {
            const { payload, account } = await resolveInvitation(token);

            const [merchant, inviter] = await Promise.all([
                MerchantContext.repositories.merchant.findById(
                    payload.merchantId
                ),
                payload.invitedBy
                    ? BusinessAuthContext.repositories.account.findById(
                          payload.invitedBy
                      )
                    : Promise.resolve(null),
            ]);
            if (!merchant) throw GENERIC_INVALID_TOKEN();

            return {
                email: account.email ?? payload.email,
                merchantName: merchant.name,
                inviterName: inviterLabel(inviter),
                alreadyClaimed: !isCredentialLessAccount(account),
            };
        },
        {
            body: t.Object({ token: t.String() }),
            response: {
                200: t.Object({
                    email: t.String(),
                    merchantName: t.String(),
                    inviterName: t.String(),
                    alreadyClaimed: t.Boolean(),
                }),
                400: t.ErrorResponse,
            },
        }
    )
    .post(
        "/claim",
        async ({
            body: { token, password, displayName },
            request,
            headers,
            server,
        }) => {
            const { payload, account } = await resolveInvitation(token);

            // Replay guard: an account that already has any credential was
            // either already claimed, or has since organically registered /
            // reset its password — either way this exact token is spent.
            if (!isCredentialLessAccount(account)) {
                throw GENERIC_INVALID_TOKEN();
            }

            BusinessAuthContext.services.password.assertValid(password);
            const passwordHash =
                await BusinessAuthContext.services.password.hash(password);

            await BusinessAuthContext.repositories.account.setPasswordHash({
                accountId: account.id,
                passwordHash,
            });
            if (displayName) {
                await BusinessAuthContext.repositories.account.setDisplayName(
                    account.id,
                    displayName
                );
            }
            // Clicking the emailed link is itself the email-ownership proof
            // — same trust argument as the first email-2FA / password-reset
            // OTP verification.
            await BusinessAuthContext.repositories.account.markEmailVerified(
                account.id
            );

            const { token: sessionToken, session } =
                await BusinessAuthContext.services.session.create({
                    accountId: account.id,
                    authMethod: "password",
                    twoFactorVerified: true,
                    ip: resolveClientIp({ request, headers, server }),
                    userAgent: request.headers.get("user-agent") ?? undefined,
                });

            const hasMerchantAccess =
                await MerchantContext.repositories.merchantAdmin.isAdmin(
                    payload.merchantId,
                    { accountId: account.id }
                );

            return {
                token: sessionToken,
                expiresAt: session.expiresAt.getTime(),
                accountId: account.id,
                merchantId: payload.merchantId,
                hasMerchantAccess,
            };
        },
        {
            body: t.Object({
                token: t.String(),
                password: t.String(),
                displayName: t.Optional(t.String({ maxLength: 120 })),
            }),
            response: {
                200: t.Object({
                    token: t.String(),
                    expiresAt: t.Number(),
                    accountId: t.String(),
                    merchantId: t.String(),
                    hasMerchantAccess: t.Boolean(),
                }),
                400: t.ErrorResponse,
            },
        }
    );
