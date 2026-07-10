import {
    extractShopDomain,
    log,
    verifyShopifySessionToken,
} from "@backend-infrastructure";
import { STEP_UP_ERROR_CODE, StepUpRequiredError, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../domain/auth";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import {
    type ResolvedBusinessAuth,
    resolveBusinessAuth,
} from "./resolveBusinessAuth";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

export { STEP_UP_ERROR_CODE };

/**
 * 401 body emitted by `requireStepUp` (with the `x-frak-auth-error:
 * step-up-required` header). Routes guarded by the macro must include it
 * in their 401 response schema.
 */
export const StepUpRequired401 = t.Union([
    t.String(),
    t.Object({
        error: t.Literal("step_up_required"),
        methods: t.Array(
            t.Union([t.Literal("email"), t.Literal("totp"), t.Literal("siwe")])
        ),
    }),
    t.ErrorResponse,
]);

/**
 * A pending (2FA-unverified) session may only reach the auth surface itself:
 * completing 2FA, logging out. Everything else treats it as unauthenticated.
 */
function isUsableSession(auth: ResolvedBusinessAuth): boolean {
    return !auth.pending2fa;
}

/**
 * Platform admin = wallet allow-list OR verified @frak-labs.com email
 * (design doc §7.3). The email check needs the account row, hence async.
 */
async function isPlatformAdminAuth(
    auth: ResolvedBusinessAuth
): Promise<boolean> {
    if (
        auth.wallet &&
        AuthContext.services.platformAdmin.isPlatformAdmin(auth.wallet)
    ) {
        return true;
    }
    if (auth.accountId) {
        return AuthContext.services.platformAdmin.isPlatformAdminAccount(
            await BusinessAuthContext.repositories.account.findById(
                auth.accountId
            )
        );
    }
    return false;
}

/**
 * Shopify SSO auto-link (§4.7): lazily resolved — only fetched once the
 * direct wallet/account/admin checks have already failed, since most
 * requests never need it.
 */
async function hasShopifyCredentialAccess(
    merchantId: string,
    accountId: string | null
): Promise<boolean> {
    if (!accountId) return false;
    const shopCredentials =
        await BusinessAuthContext.repositories.credential.findShopifyByAccount(
            accountId
        );
    const shopDomains = shopCredentials
        .map((c) => c.shopDomain)
        .filter((d): d is string => !!d);
    if (!shopDomains.length) return false;
    return MerchantContext.services.authorization.hasAccess(merchantId, {
        shopDomains,
    });
}

export const businessSessionContext = new Elysia({
    name: "Context.businessSession",
})
    .guard({
        headers: t.Object({
            "x-business-auth": t.Optional(t.String()),
            "x-shopify-session-token": t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers, request }) => {
        const businessAuth = headers["x-business-auth"];
        if (businessAuth) {
            const auth = await resolveBusinessAuth(businessAuth);
            if (auth && isUsableSession(auth)) {
                return {
                    businessSession: auth,
                    shopifySession: null as ShopifySessionToken | null,
                    hasMerchantAccess: async (merchantId: string) => {
                        if (
                            await MerchantContext.services.authorization.hasAccess(
                                merchantId,
                                auth
                            )
                        )
                            return true;

                        if (
                            await hasShopifyCredentialAccess(
                                merchantId,
                                auth.accountId
                            )
                        ) {
                            return true;
                        }

                        if (
                            SAFE_METHODS.has(request.method) &&
                            (await isPlatformAdminAuth(auth))
                        ) {
                            log.info(
                                {
                                    wallet: auth.wallet,
                                    accountId: auth.accountId,
                                    merchantId,
                                    method: request.method,
                                    path: request.url,
                                },
                                "platform-admin read-only access"
                            );
                            return true;
                        }
                        return false;
                    },
                };
            }
        }

        const shopifyToken = headers["x-shopify-session-token"];
        if (shopifyToken) {
            const session = await verifyShopifySessionToken(shopifyToken);
            if (session) {
                const shopDomain = extractShopDomain(session.dest);
                return {
                    businessSession: null as ResolvedBusinessAuth | null,
                    shopifySession: session,
                    hasMerchantAccess: shopDomain
                        ? (merchantId: string) =>
                              MerchantContext.services.authorization.hasAccessByDomain(
                                  merchantId,
                                  shopDomain
                              )
                        : (_merchantId: string) =>
                              Promise.resolve(false as boolean),
                };
            }
        }

        return {
            businessSession: null as ResolvedBusinessAuth | null,
            shopifySession: null as ShopifySessionToken | null,
            hasMerchantAccess: (_merchantId: string) =>
                Promise.resolve(false as boolean),
        };
    })
    .macro({
        /**
         * NOTE on macro semantics: Elysia passes the route-side value as the
         * macro argument (`{ businessAuthenticated: true }` ⇒ `enabled =
         * true`). Guards must therefore no-op on a FALSY argument — the
         * previous `(skip?: boolean)` shape silently disabled every
         * `macro: true` usage.
         */
        businessAuthenticated(enabled?: boolean) {
            if (!enabled) return;

            return {
                beforeHandle: async ({ headers, set }) => {
                    const businessAuth = headers["x-business-auth"];
                    if (businessAuth) {
                        const auth = await resolveBusinessAuth(businessAuth);
                        if (auth && isUsableSession(auth)) return;
                    }

                    const shopifyToken = headers["x-shopify-session-token"];
                    if (shopifyToken) {
                        const session =
                            await verifyShopifySessionToken(shopifyToken);
                        if (session) return;

                        set.headers["X-Shopify-Retry-Invalid-Session-Request"] =
                            "1";
                    }

                    return status(
                        401,
                        "Unauthorized - No valid authentication"
                    );
                },
            };
        },
        // NOTE: the design doc (§4.5) sketched a `requireWallet` macro, but no
        // backend route needs it — all wallet-signed bank actions are pure
        // frontend transactions (doc §1.2). Gating lives client-side via
        // `useCapabilities()`; add the macro back only when a backend route
        // actually requires a wallet-bound session.
        /**
         * Sensitive-action guard: requires a 2FA verification within the
         * 5-minute freshness window (§4.8 of the design doc). Embedded
         * Shopify sessions are exempt — Shopify admin enforces its own
         * staff 2FA (§4.11). On a stale session, emits the
         * `x-frak-auth-error: step-up-required` protocol so the Eden fetch
         * wrapper can open the right 2FA modal and transparently retry.
         */
        requireStepUp(enabled?: boolean) {
            if (!enabled) return;

            return {
                beforeHandle: async ({ headers }) => {
                    // Embedded Shopify admin session — exempt (§4.11)
                    const shopifyToken = headers["x-shopify-session-token"];
                    if (shopifyToken) {
                        const session =
                            await verifyShopifySessionToken(shopifyToken);
                        if (session) return;
                    }

                    const businessAuth = headers["x-business-auth"];
                    if (!businessAuth) {
                        return status(401, "Unauthorized");
                    }
                    const auth = await resolveBusinessAuth(businessAuth);
                    if (!auth || !isUsableSession(auth)) {
                        return status(401, "Unauthorized");
                    }

                    if (
                        auth.twoFactorVerifiedAt &&
                        BusinessAuthContext.services.session.isStepUpFresh({
                            twoFactorVerifiedAt: auth.twoFactorVerifiedAt,
                        })
                    ) {
                        return;
                    }

                    // Stale or never-verified: surface the step-up protocol.
                    // Legacy JWT sessions have no account: their only path is
                    // a fresh SIWE login, so advertise `siwe` alone.
                    const methods = auth.accountId
                        ? await BusinessAuthContext.services.account.getEnabledTwoFactorMethods(
                              auth.accountId
                          )
                        : ["siwe" as const];

                    throw new StepUpRequiredError(methods);
                },
            };
        },
        /**
         * Platform-admin-only guard for billing admin mutation routes
         * (deposits/withdrawals/monthly-bills). Deliberately independent from
         * `hasMerchantAccess`, whose platform-admin bypass is read-only /
         * safe-methods-only and must never authorize mutations. Wallet
         * allow-list or verified @frak-labs.com email (§7.3); the Shopify
         * session path is always rejected here.
         */
        platformAdminAuthenticated(enabled?: boolean) {
            if (!enabled) return;

            return {
                beforeHandle: async ({ headers }) => {
                    const businessAuth = headers["x-business-auth"];
                    if (!businessAuth) {
                        return status(401, "Unauthorized");
                    }

                    const auth = await resolveBusinessAuth(businessAuth);
                    if (!auth || !isUsableSession(auth)) {
                        return status(401, "Unauthorized");
                    }

                    if (!(await isPlatformAdminAuth(auth))) {
                        return status(403, "Platform admin access required");
                    }
                },
            };
        },
    })
    .as("scoped");
