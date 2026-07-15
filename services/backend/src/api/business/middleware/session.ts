import {
    extractShopDomain,
    log,
    verifyShopifySessionToken,
} from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../domain/auth";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import { assertStepUpFresh } from "../auth/common";
import {
    type ResolvedBusinessAuth,
    resolveBusinessAuth,
} from "./resolveBusinessAuth";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * 401 response schema for step-up-guarded routes. The step-up challenge is
 * signalled entirely via headers (`x-frak-auth-error: step-up-required` +
 * `x-frak-auth-methods`), so its body is the plain `t.ErrorResponse` — the
 * union just also admits the bare-string 401s these handlers still return
 * (e.g. `status(401, "Authentication required")`).
 */
export const StepUpRequired401 = t.Union([t.String(), t.ErrorResponse]);

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
export async function isPlatformAdminAuth(
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
 * requests never need it. An account holds at most one Shopify identity
 * (design doc §4.3), so this is a single-row read, not a credential scan.
 */
async function hasShopifyCredentialAccess(
    merchantId: string,
    accountId: string | null
): Promise<boolean> {
    if (!accountId) return false;
    const account =
        await BusinessAuthContext.repositories.account.findById(accountId);
    if (!account?.shopifyShopDomain) return false;
    return MerchantContext.services.authorization.hasAccess(merchantId, {
        shopDomain: account.shopifyShopDomain,
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
        // NOTE on macro semantics: Elysia passes the route-side value as the
        // macro argument (`{ requireStepUp: true }` ⇒ `enabled = true`).
        // Guards must therefore no-op on a FALSY argument — the previous
        // `(skip?: boolean)` shape silently disabled every `macro: true`
        // usage.
        //
        // NOTE: the design doc (§4.5) sketched `requireWallet` and
        // `businessAuthenticated` macros, but no backend route needs them —
        // plain authentication gates live in the handlers (via the
        // plugin-resolved sessions), and wallet-signed bank actions are pure
        // frontend transactions (doc §1.2, `useCapabilities()`).
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
                // Consumes the plugin-resolved session (§2.3) rather than
                // re-verifying the Shopify JWT + re-resolving the DB session.
                beforeHandle: async ({ shopifySession, businessSession }) => {
                    // Embedded Shopify admin session — exempt (§4.11).
                    if (shopifySession) return;

                    if (!businessSession) {
                        return status(401, "Unauthorized");
                    }

                    // Shared step-up freshness gate (S1) — throws the
                    // `StepUpRequiredError` protocol when stale/never-verified.
                    await assertStepUpFresh(businessSession);
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
                // Consumes the plugin-resolved session (§2.3); the Shopify
                // session path is never a platform admin, so it's ignored.
                beforeHandle: async ({ businessSession }) => {
                    if (!businessSession) {
                        return status(401, "Unauthorized");
                    }

                    if (!(await isPlatformAdminAuth(businessSession))) {
                        return status(403, "Platform admin access required");
                    }
                },
            };
        },
    })
    .as("scoped");
