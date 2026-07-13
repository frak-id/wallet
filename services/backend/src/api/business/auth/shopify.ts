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
 * Land on `/login/2fa` carrying the session token in the URL hash (never the
 * query string, so the opaque token never hits server logs / Referer
 * headers). Shopify SSO grants a usable, non-pending session with no
 * login-time 2FA (the OAuth grant is the login factor), so the page adopts
 * the token as a full session and goes straight to the dashboard.
 */
function loginRedirectUrl(token: string): string {
    const hash = new URLSearchParams({ token, sso: "1" });
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

            // Shopify OAuth is itself the login factor: mint a usable session
            // and send the admin straight to the dashboard — no login-time 2FA
            // (unlike password/SIWE). The session is deliberately NOT
            // step-up-fresh (`twoFactorVerifiedAt` stays null), so sensitive
            // actions still require a real step-up (§4.8); an account with no
            // enrolled factor is prompted to set one up in Settings.
            const { token } = await BusinessAuthContext.services.session.create(
                {
                    accountId: account.id,
                    authMethod: "shopify",
                    ip: resolveClientIp({ request, headers, server }),
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
