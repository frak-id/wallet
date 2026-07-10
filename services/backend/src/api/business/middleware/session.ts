import {
    extractShopDomain,
    log,
    verifyShopifySessionToken,
} from "@backend-infrastructure";
import { AUTH_ERROR_HEADER } from "@backend-infrastructure/macro/authError";
import { t } from "@backend-utils";
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

export const STEP_UP_ERROR_CODE = "step-up-required";

/**
 * A pending (2FA-unverified) session may only reach the auth surface itself:
 * completing 2FA, logging out. Everything else treats it as unauthenticated.
 */
function isUsableSession(auth: ResolvedBusinessAuth): boolean {
    return !auth.pending2fa;
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
                            auth.wallet &&
                            (await MerchantContext.services.authorization.hasAccess(
                                merchantId,
                                auth.wallet
                            ))
                        )
                            return true;
                        if (
                            auth.wallet &&
                            AuthContext.services.platformAdmin.isPlatformAdmin(
                                auth.wallet
                            ) &&
                            SAFE_METHODS.has(request.method)
                        ) {
                            log.info(
                                {
                                    wallet: auth.wallet,
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
        businessAuthenticated(skip?: boolean) {
            if (skip) return;

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
        /**
         * Walletless accounts cannot perform user-wallet-signed onchain
         * actions. Embedded Shopify sessions pass (they are wallet-free by
         * design and never reach wallet-signed flows).
         */
        requireWallet(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers }) => {
                    const shopifyToken = headers["x-shopify-session-token"];
                    if (shopifyToken) return;

                    const businessAuth = headers["x-business-auth"];
                    if (!businessAuth) {
                        return status(401, "Unauthorized");
                    }
                    const auth = await resolveBusinessAuth(businessAuth);
                    if (!auth || !isUsableSession(auth)) {
                        return status(401, "Unauthorized");
                    }
                    if (!auth.wallet) {
                        return status(403, { error: "WALLET_REQUIRED" });
                    }
                },
            };
        },
        /**
         * Sensitive-action guard: requires a 2FA verification within the
         * 5-minute freshness window (§4.8 of the design doc). Embedded
         * Shopify sessions are exempt — Shopify admin enforces its own
         * staff 2FA (§4.11). On a stale session, emits the
         * `x-frak-auth-error: step-up-required` protocol so the Eden fetch
         * wrapper can open the right 2FA modal and transparently retry.
         */
        requireStepUp(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers, set }) => {
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

                    set.headers[AUTH_ERROR_HEADER] = STEP_UP_ERROR_CODE;
                    return status(401, {
                        error: "step_up_required",
                        methods,
                    });
                },
            };
        },
        /**
         * Platform-admin-only guard for billing admin mutation routes
         * (deposits/withdrawals/monthly-bills). Deliberately independent from
         * `hasMerchantAccess`, whose platform-admin bypass is read-only /
         * safe-methods-only and must never authorize mutations. The Shopify
         * session path has no wallet and is always rejected here.
         */
        platformAdminAuthenticated(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers }) => {
                    const businessAuth = headers["x-business-auth"];
                    if (!businessAuth) {
                        return status(401, "Unauthorized");
                    }

                    const auth = await resolveBusinessAuth(businessAuth);
                    if (!auth || !isUsableSession(auth) || !auth.wallet) {
                        return status(401, "Unauthorized");
                    }

                    if (
                        !AuthContext.services.platformAdmin.isPlatformAdmin(
                            auth.wallet
                        )
                    ) {
                        return status(403, "Platform admin access required");
                    }
                },
            };
        },
    })
    .as("scoped");
