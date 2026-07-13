import { log, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import { generateState } from "arctic";
import { Elysia, status } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { resolveClientIp } from "./common";

function statesMatch(a: string, b: string): boolean {
    return (
        a.length === b.length &&
        constantTimeEqual(
            new TextEncoder().encode(a),
            new TextEncoder().encode(b)
        )
    );
}

const STATE_COOKIE_NAME = "shopify_sso_state";
const STATE_COOKIE_TTL_SEC = 10 * 60;

/**
 * The callback URL passed to Shopify must exactly match one of the app's
 * registered `redirect_urls` (`shopify.app.*.toml`, updated alongside this
 * change). Derived from the live request's own origin at both authorize and
 * callback time — the backend already does this everywhere else (SIWE
 * origin checks) rather than hardcoding a public-URL env — so the two legs
 * always agree with each other regardless of which backend host served them.
 *
 * Scheme is forced to `https`: the GCP load balancer terminates TLS and
 * forwards to the backend over plain HTTP, so `request.url` reads `http`,
 * but Shopify's registered `redirect_urls` are all `https` and matched
 * exactly — an `http` redirect_uri fails the whitelist check.
 */
function callbackUrl(requestUrl: string): string {
    return `https://${new URL(requestUrl).host}/business/auth/shopify/callback`;
}

/**
 * Land on `/login/2fa` carrying the pending session token in the URL hash
 * (never the query string, so the opaque token never hits server logs /
 * Referer headers). `verified` marks a session that already cleared 2FA
 * server-side (the no-enrolled-method Shopify SSO case, below) so the page
 * skips the challenge and goes straight to the dashboard.
 */
function loginRedirectUrl(token: string, verified: boolean): string {
    const hash = new URLSearchParams({ token });
    if (verified) hash.set("verified", "1");
    return `${process.env.BUSINESS_URL}/login/2fa#${hash.toString()}`;
}

function errorRedirectUrl(reason: string): string {
    return `${process.env.BUSINESS_URL}/login?error=${encodeURIComponent(reason)}`;
}

/**
 * Shopify SSO (design doc §4.7) — OAuth authorization-code flow with online
 * (per-user) tokens against the standalone dashboard, distinct from the
 * embedded App Bridge session-token flow used by `apps/shopify`
 * (`x-shopify-session-token`, §4.11, untouched).
 */
export const shopifyAuthRoutes = new Elysia({ prefix: "/shopify" })
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 20 }))
    .get(
        "/authorize",
        ({ query: { shop }, cookie, request }) => {
            const sso = BusinessAuthContext.services.shopifySso;
            if (!sso.isValidShopDomain(shop)) {
                return status(400, "Invalid shop domain");
            }

            const state = generateState();
            cookie[STATE_COOKIE_NAME]?.set({
                value: state,
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                maxAge: STATE_COOKIE_TTL_SEC,
                path: "/business/auth/shopify",
            });

            const url = sso.createAuthorizationUrl({
                shop,
                callbackUrl: callbackUrl(request.url),
                state,
            });

            return Response.redirect(url.toString(), 302);
        },
        {
            query: t.Object({ shop: t.String() }),
            response: { 400: t.String() },
        }
    )
    .get(
        "/callback",
        async ({ query, cookie, request, headers, server }) => {
            const sso = BusinessAuthContext.services.shopifySso;
            const { shop, code, state } = query;

            const cookieStateValue = cookie[STATE_COOKIE_NAME]?.value;
            cookie[STATE_COOKIE_NAME]?.remove();
            const cookieState =
                typeof cookieStateValue === "string" ? cookieStateValue : null;

            if (
                !shop ||
                !code ||
                !state ||
                !cookieState ||
                !statesMatch(state, cookieState) ||
                !sso.isValidShopDomain(shop)
            ) {
                return Response.redirect(errorRedirectUrl("shopify"), 302);
            }

            const url = new URL(request.url);
            if (!sso.verifyCallbackHmac(url.searchParams)) {
                log.warn({ shop }, "Shopify SSO callback HMAC mismatch");
                return Response.redirect(errorRedirectUrl("shopify"), 302);
            }

            const identity = await sso.exchangeCodeForIdentity({
                shop,
                code,
                callbackUrl: callbackUrl(request.url),
            });
            if (!identity) {
                return Response.redirect(errorRedirectUrl("shopify"), 302);
            }

            const account =
                await BusinessAuthContext.services.account.upsertShopifyAccount(
                    {
                        shopifyUserId: identity.associatedUser.id,
                        shopDomain: identity.shopDomain,
                        email: identity.associatedUser.email,
                    }
                );

            // Shopify SSO is not exempt from 2FA (§4.8, unlike the embedded
            // App Bridge flow §4.11) — but 2FA needs an enrolled factor to
            // challenge. When the account has none (email dropped on a
            // collision, no TOTP, no wallet), the Shopify OAuth grant is the
            // sole proof of identity and stands on its own: mint a verified
            // session rather than dead-ending on an unanswerable challenge.
            // Sensitive actions still gate on their own step-up bootstrap.
            const methods =
                await BusinessAuthContext.services.account.getEnabledTwoFactorMethods(
                    account.id
                );
            const twoFactorVerified = methods.length === 0;

            const { token } = await BusinessAuthContext.services.session.create(
                {
                    accountId: account.id,
                    authMethod: "shopify",
                    twoFactorVerified,
                    ip: resolveClientIp({ request, headers, server }),
                    userAgent: request.headers.get("user-agent") ?? undefined,
                }
            );

            return Response.redirect(
                loginRedirectUrl(token, twoFactorVerified),
                302
            );
        },
        {
            query: t.Object({
                shop: t.Optional(t.String()),
                code: t.Optional(t.String()),
                state: t.Optional(t.String()),
                hmac: t.Optional(t.String()),
                timestamp: t.Optional(t.String()),
            }),
        }
    );
