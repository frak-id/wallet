import { log, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { generateState } from "arctic";
import { Elysia, status } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";

const STATE_COOKIE_NAME = "shopify_sso_state";
const STATE_COOKIE_TTL_SEC = 10 * 60;

/**
 * The callback URL passed to Shopify must exactly match one of the app's
 * registered `redirect_urls` (`shopify.app.*.toml`, updated alongside this
 * change). Derived from the live request's own origin at both authorize and
 * callback time — the backend already does this everywhere else (SIWE
 * origin checks) rather than hardcoding a public-URL env — so the two legs
 * always agree with each other regardless of which backend host served them.
 */
function callbackUrl(requestUrl: string): string {
    return `${new URL(requestUrl).origin}/business/auth/shopify/callback`;
}

function loginRedirectUrl(token: string): string {
    return `${process.env.BUSINESS_URL}/login/2fa#token=${encodeURIComponent(token)}`;
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
        async ({ query, cookie, request }) => {
            const sso = BusinessAuthContext.services.shopifySso;
            const { shop, code, state } = query;

            const cookieState = cookie[STATE_COOKIE_NAME]?.value;
            cookie[STATE_COOKIE_NAME]?.remove();

            if (
                !shop ||
                !code ||
                !state ||
                !cookieState ||
                state !== cookieState ||
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

            // Pending session: 2FA required before it can do anything but
            // complete 2FA / log out (§4.8) — Shopify SSO is not exempt,
            // only the embedded App Bridge flow is (§4.11).
            const { token } = await BusinessAuthContext.services.session.create(
                {
                    accountId: account.id,
                    authMethod: "shopify",
                    userAgent: request.headers.get("user-agent") ?? undefined,
                }
            );

            return Response.redirect(loginRedirectUrl(token), 302);
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
