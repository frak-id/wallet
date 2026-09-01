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
 * Validate a post-login redirect target before it's allowed to travel
 * through the OAuth `state` param. Mirrors `apps/business`'s
 * `safeRedirectTarget` (kept as an independent copy — this is the
 * authoritative, server-side gate; the client's own check is UX-only and
 * MUST NOT be trusted). Only a single-slash relative path is accepted —
 * anything else (absolute URL, protocol-relative `//host`, backslash
 * variants a browser may normalize to `//`) is rejected outright rather
 * than silently falling back, so callers can tell "no redirect" apart from
 * "the caller tried something bad".
 */
export function safeRelativeRedirect(
    redirect: string | null | undefined
): string | null {
    if (!redirect) return null;
    if (!redirect.startsWith("/")) return null;
    if (redirect.startsWith("//") || redirect.startsWith("/\\")) return null;
    if (redirect.includes("\\")) return null;
    return redirect;
}

/**
 * Pack the CSRF nonce and an optional post-login redirect into a single
 * opaque OAuth `state` value. Shopify echoes `state` back verbatim on the
 * callback and it is itself covered by `verifyCallbackHmac` (signs every
 * query param except `hmac`/`signature`), so anything embedded here is
 * tamper-proof on return — a strictly better carrier than a second,
 * unauthenticated cookie that would need to stay in sync with this one.
 * `generateState()` (arctic) emits unpadded base64url — a dot-free
 * alphabet — so the nonce can never collide with the `.` separator below.
 */
export function packState(nonce: string, redirect: string | null): string {
    if (!redirect) return nonce;
    return `${nonce}.${Buffer.from(redirect, "utf8").toString("base64url")}`;
}

/**
 * Split a returned `state` back into its nonce and optional redirect.
 * Splits on the FIRST `.` only — the redirect's own base64url payload
 * cannot contain a `.`, but splitting on the first occurrence keeps this
 * correct even if that ever changes. The redirect segment is re-validated
 * with `safeRelativeRedirect` (belt-and-braces): the HMAC guarantees the
 * state wasn't tampered with, but decoding still shouldn't be trusted
 * blindly against a future change to what gets embedded.
 */
export function unpackState(state: string): {
    nonce: string;
    redirect: string | null;
} {
    const dotIndex = state.indexOf(".");
    if (dotIndex === -1) return { nonce: state, redirect: null };
    const nonce = state.slice(0, dotIndex);
    const encoded = state.slice(dotIndex + 1);
    let decoded: string | null = null;
    try {
        decoded = Buffer.from(encoded, "base64url").toString("utf8");
    } catch {
        decoded = null;
    }
    return { nonce, redirect: safeRelativeRedirect(decoded) };
}

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
 * the token as a full session and goes straight to the dashboard. The
 * post-login `redirect` (already validated, extracted from the HMAC-verified
 * `state`) is a non-secret relative path, so it travels as a normal query
 * param — only the opaque token is confined to the hash.
 */
function loginRedirectUrl(token: string, redirect: string | null): string {
    const hash = new URLSearchParams({ token, sso: "1" });
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    return `${process.env.BUSINESS_URL}/login/2fa${query}#${hash.toString()}`;
}

/**
 * Generic pre-HMAC failure: params are missing, the state nonce doesn't
 * match the cookie, or the shop domain is malformed — none of that is
 * trustworthy yet, so nothing but the bare error reason is carried.
 */
function errorRedirectUrl(reason: string): string {
    return `${process.env.BUSINESS_URL}/login?error=${encodeURIComponent(reason)}`;
}

/**
 * Post-HMAC-verified failure (identity exchange or account upsert failed
 * after the callback's authenticity was already confirmed): `shop` and
 * `redirect` are both trustworthy at this point, so land on `/login/shopify`
 * with them prefilled — the retry is then a single click instead of
 * re-typing the shop domain from scratch.
 */
function trustedErrorRedirectUrl(params: {
    reason: string;
    shop: string;
    redirect: string | null;
}): string {
    const search = new URLSearchParams({
        error: params.reason,
        shop: params.shop,
    });
    if (params.redirect) search.set("redirect", params.redirect);
    return `${process.env.BUSINESS_URL}/login/shopify?${search.toString()}`;
}

/**
 * Shopify SSO (design doc §4.7) — OAuth authorization-code flow with online
 * (per-user) tokens against the standalone dashboard, distinct from the
 * embedded App Bridge session-token flow used by `apps/shopify`
 * (`x-shopify-session-token`, §4.11, untouched).
 */
export const shopifyAuthRoutes = new Elysia({ prefix: "/shopify" })
    .use(
        rateLimitMiddleware({
            bucket: "business-auth-shopify",
            windowMs: 60_000,
            maxRequests: 20,
        })
    )
    .get(
        "/authorize",
        ({ query: { shop, redirect }, cookie, request }) => {
            const sso = BusinessAuthContext.services.shopifySso;
            if (!sso.isValidShopDomain(shop)) {
                return status(400, "Invalid shop domain");
            }

            // Validated server-side — the client's own check (if any) is UX
            // only. An invalid/malicious value is silently dropped rather
            // than rejecting the whole authorize call: the redirect is a
            // pure enhancement, not required for SSO to function.
            const validRedirect = safeRelativeRedirect(redirect);

            const nonce = generateState();
            cookie[STATE_COOKIE_NAME]?.set({
                // Cookie stores ONLY the nonce — the callback splits the
                // returned (HMAC-verified) state and compares just this part.
                value: nonce,
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                maxAge: STATE_COOKIE_TTL_SEC,
                path: "/business/auth/shopify",
            });

            const url = sso.createAuthorizationUrl({
                shop,
                callbackUrl: callbackUrl(request.url),
                state: packState(nonce, validRedirect),
            });

            return Response.redirect(url.toString(), 302);
        },
        {
            query: t.Object({
                shop: t.String(),
                redirect: t.Optional(t.String()),
            }),
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
            const cookieNonce =
                typeof cookieStateValue === "string" ? cookieStateValue : null;

            // `state` may be `nonce` or `nonce.<base64url-redirect>` — only the
            // nonce half is compared against the cookie; the redirect half is
            // untrusted until the HMAC check below passes.
            const { nonce: returnedNonce, redirect: pendingRedirect } = state
                ? unpackState(state)
                : { nonce: null, redirect: null };

            if (
                !shop ||
                !code ||
                !state ||
                !cookieNonce ||
                !returnedNonce ||
                !statesMatch(returnedNonce, cookieNonce) ||
                !sso.isValidShopDomain(shop)
            ) {
                // Pre-HMAC failure: nothing here is trustworthy yet, so only the
                // generic reason is carried — never `shop`/`redirect` from an
                // unverified request.
                return Response.redirect(errorRedirectUrl("shopify"), 302);
            }

            const url = new URL(request.url);
            if (!sso.verifyCallbackHmac(url.searchParams)) {
                log.warn({ shop }, "Shopify SSO callback HMAC mismatch");
                return Response.redirect(errorRedirectUrl("shopify"), 302);
            }

            // HMAC verified from here on: `shop` and `pendingRedirect` (echoed
            // back inside the signed `state`) are now trustworthy.
            const identity = await sso.exchangeCodeForIdentity({
                shop,
                code,
                callbackUrl: callbackUrl(request.url),
            });
            if (!identity) {
                return Response.redirect(
                    trustedErrorRedirectUrl({
                        reason: "shopify",
                        shop,
                        redirect: pendingRedirect,
                    }),
                    302
                );
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

            return Response.redirect(
                loginRedirectUrl(token, pendingRedirect),
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
