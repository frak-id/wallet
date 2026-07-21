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
 * Unified merchant-access capability object, resolved once per request and
 * consumed by both route handlers and the `requireMerchantAccess` macro.
 * Replaces the former `hasMerchantAccess` / `hasGenuineMerchantAccess`
 * boolean pair so new capabilities (e.g. a future granular permission
 * system) are additional fields here rather than new context functions.
 *
 * - `read` / `write`: `write` implies `read`. A genuine grant (real
 *   ownership/admin/Shopify-link) satisfies both. The platform-admin
 *   read-only bypass satisfies only `read` — mutations must never ride it.
 * - `readSecrets`: genuine-only, gates fields that must never reach the
 *   platform-admin bypass (e.g. webhook signing key, finding 2.8).
 * - `source`: coarse provenance for logging/UI, not a fine-grained role
 *   system — `"admin"` covers both real admin-row and Shopify-credential
 *   grants on the business-auth path (owner is distinguished via
 *   `checkAccess`'s `role`, at no extra query cost).
 */
export type MerchantPermissions = {
    read: boolean;
    write: boolean;
    readSecrets: boolean;
    source: "owner" | "admin" | "shopify" | "platform-admin" | "none";
};

const NO_MERCHANT_PERMISSIONS: MerchantPermissions = {
    read: false,
    write: false,
    readSecrets: false,
    source: "none",
};

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
export async function hasShopifyCredentialAccess(
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

/**
 * Genuine grants: direct wallet/account/admin-row ownership (via
 * `checkAccess`, reusing its `role` for `source` so distinguishing
 * owner/admin costs no extra query) or the Shopify-credential auto-link.
 * Falls back to the read-only platform-admin grant, logging its use. Neither
 * genuine path rides that bypass.
 *
 * Deliberately method-independent: the resolved capabilities describe what
 * the caller *may* do, and consumers (the `requireMerchantAccess` macro,
 * inline route checks) pick the capability the operation needs. The
 * platform-admin grant is `read`-only regardless of the request method —
 * the former `hasMerchantAccess` encoded the same restriction by sniffing
 * `SAFE_METHODS` here instead.
 */
async function resolveBusinessMerchantPermissions(
    merchantId: string,
    auth: ResolvedBusinessAuth,
    request: Request
): Promise<MerchantPermissions> {
    const access = await MerchantContext.services.authorization.checkAccess(
        merchantId,
        auth
    );
    if (access.hasAccess) {
        return {
            read: true,
            write: true,
            readSecrets: true,
            source: access.role === "owner" ? "owner" : "admin",
        };
    }

    if (await hasShopifyCredentialAccess(merchantId, auth.accountId)) {
        return { read: true, write: true, readSecrets: true, source: "admin" };
    }

    if (await isPlatformAdminAuth(auth)) {
        // Audit trail for finding 2.8-adjacent access: fires whenever a
        // platform admin resolves a (read-only) grant on a merchant they
        // don't genuinely belong to, whether or not the route ends up
        // honoring it.
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
        return {
            read: true,
            write: false,
            readSecrets: false,
            source: "platform-admin",
        };
    }

    return NO_MERCHANT_PERMISSIONS;
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
                    getMerchantPermissions: (merchantId: string) =>
                        resolveBusinessMerchantPermissions(
                            merchantId,
                            auth,
                            request
                        ),
                };
            }
        }

        const shopifyToken = headers["x-shopify-session-token"];
        if (shopifyToken) {
            const session = await verifyShopifySessionToken(shopifyToken);
            if (session) {
                const shopDomain = extractShopDomain(session.dest);
                // An embedded Shopify session's access is always a real
                // domain match — genuine by construction, so it grants every
                // capability.
                const getMerchantPermissions = async (
                    merchantId: string
                ): Promise<MerchantPermissions> => {
                    if (!shopDomain) return NO_MERCHANT_PERMISSIONS;
                    const hasAccess =
                        await MerchantContext.services.authorization.hasAccessByDomain(
                            merchantId,
                            shopDomain
                        );
                    if (!hasAccess) return NO_MERCHANT_PERMISSIONS;
                    return {
                        read: true,
                        write: true,
                        readSecrets: true,
                        source: "shopify",
                    };
                };
                return {
                    businessSession: null as ResolvedBusinessAuth | null,
                    shopifySession: session,
                    getMerchantPermissions,
                };
            }
        }

        return {
            businessSession: null as ResolvedBusinessAuth | null,
            shopifySession: null as ShopifySessionToken | null,
            getMerchantPermissions: (_merchantId: string) =>
                Promise.resolve(NO_MERCHANT_PERMISSIONS),
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
         * `getMerchantPermissions`, whose platform-admin grant is read-only
         * (`read: true, write: false`) and must never authorize mutations.
         * Wallet allow-list or verified @frak-labs.com email (§7.3); the
         * Shopify session path is always rejected here.
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
        /**
         * Standard merchant-scoped guard: any authenticated session
         * (business or Shopify) that resolves access to `params.merchantId`
         * via the plugin-resolved `getMerchantPermissions` (§2.3), including
         * its Shopify-credential and read-only platform-admin grants. Method
         * maps to capability: GET/HEAD require `read`, everything else
         * requires `write` — byte-for-byte equivalent to the former
         * `hasMerchantAccess`, whose platform-admin bypass was already gated
         * on `SAFE_METHODS`. This is the ~37x copy-pasted auth check across
         * the merchant routes — kept byte-for-byte identical (same status
         * codes/bodies) so no route's response contract changes.
         */
        requireMerchantAccess(enabled?: boolean) {
            if (!enabled) return;

            return {
                beforeHandle: async ({
                    params,
                    request,
                    businessSession,
                    shopifySession,
                    getMerchantPermissions,
                }) => {
                    if (!businessSession && !shopifySession) {
                        return status(401, "Authentication required");
                    }

                    const perms = await getMerchantPermissions?.(
                        (params as { merchantId: string }).merchantId
                    );
                    const hasAccess = SAFE_METHODS.has(request.method)
                        ? perms?.read
                        : perms?.write;
                    if (!hasAccess) {
                        return status(403, "Access denied");
                    }
                },
            };
        },
    })
    .as("scoped");
