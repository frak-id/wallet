import {
    extractShopDomain,
    log,
    rateLimitMiddleware,
} from "@backend-infrastructure";
import { HttpError, matchesShopDomain, t } from "@backend-utils";
import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import { AffiliateContext } from "../../../domain/affiliate";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { MerchantContext } from "../../../domain/merchant";
import type { RegistrationIdentity } from "../../../domain/merchant/services/MerchantRegistrationService";
import type { DnsProofOwner } from "../../../infrastructure/dns/DnsCheckRepository";
import type { ResolvedBusinessAuth } from "../middleware/resolveBusinessAuth";
import {
    businessSessionContext,
    isPlatformAdminAuth,
    StepUpRequired401,
} from "../middleware/session";

/**
 * DNS proof identity for the session: wallet when present (legacy JWT +
 * wallet accounts), business account otherwise (walletless, §4.10).
 */
function dnsOwnerFromSession(
    session: ResolvedBusinessAuth
): DnsProofOwner | null {
    if (session.wallet) return { wallet: session.wallet };
    if (session.accountId) return { accountId: session.accountId };
    return null;
}

export const merchantRegistrationRoutes = new Elysia({ prefix: "/register" })
    // `/register` triggers a real bank deployment and is reachable via the
    // step-up-exempt embedded branch; `/verify` is a domain-registration
    // oracle. IP-keyed low ceiling over the whole registration group (every
    // other auth route already carries one).
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .use(businessSessionContext)
    .get(
        "/dns-txt",
        async ({ query: { domain }, businessSession }) => {
            const owner = businessSession
                ? dnsOwnerFromSession(businessSession)
                : null;
            if (!owner) {
                return status(401, "Authentication required");
            }

            const dnsTxt =
                MerchantContext.services.registration.getDnsTxtString(
                    domain,
                    owner
                );

            return { dnsTxt };
        },
        {
            query: t.Object({
                domain: t.String(),
            }),
            response: {
                200: t.Object({
                    dnsTxt: t.String(),
                }),
                400: t.ErrorResponse,
                401: t.String(),
            },
        }
    )
    .get(
        "/verify",
        async ({ query: { domain, setupCode }, businessSession }) => {
            const owner = businessSession
                ? dnsOwnerFromSession(businessSession)
                : null;
            if (!owner) {
                return {
                    isDomainValid: false,
                    isAlreadyRegistered: false,
                    verifiedViaShopify: false,
                };
            }

            const dnsCheck = MerchantContext.repositories.dnsCheck;
            const normalizedDomain = dnsCheck.getNormalizedDomain(domain);

            // §4.10 third bypass: surfaced here too, so the frontend can show
            // the "Domain verified thanks to your Shopify session" banner
            // before the user ever touches the DNS TXT flow.
            const verifiedViaShopify = await isVerifiedViaShopify(
                businessSession?.accountId ?? null,
                normalizedDomain
            );

            const isDomainValid =
                verifiedViaShopify ||
                (await dnsCheck.isValidDomain({
                    domain: normalizedDomain,
                    owner,
                    setupCode,
                    // Walletless setup codes bind to the account email.
                    email: setupCode
                        ? await accountEmail(businessSession?.accountId ?? null)
                        : null,
                }));

            const existingMerchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    normalizedDomain
                );

            return {
                isDomainValid,
                isAlreadyRegistered: existingMerchant !== null,
                verifiedViaShopify,
            };
        },
        {
            query: t.Object({
                domain: t.String(),
                setupCode: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    isDomainValid: t.Boolean(),
                    isAlreadyRegistered: t.Boolean(),
                    verifiedViaShopify: t.Boolean(),
                }),
                400: t.ErrorResponse,
            },
        }
    )
    .post(
        "",
        async ({ body, request, shopifySession, businessSession }) => {
            const origin = request.headers.get("origin") ?? "";

            // §4.12 inline embedded mint: a verified App Bridge token with NO
            // business session at all is a third, distinct identity. Reuse
            // the session the `businessSessionContext` plugin already verified
            // (§2.3) rather than re-verifying the token here.
            const shopifyRegistration = businessSession
                ? null
                : resolveShopifySessionIdentity(shopifySession, body);

            if (shopifyRegistration) {
                return registerFromShopifySession(shopifyRegistration);
            }

            // Identity resolution (§4.10):
            //  - SIWE proof in the body → wallet path (works for legacy JWT
            //    sessions too; account attached when the session has one).
            //  - No proof → walletless path: requires a full DB session (the
            //    step-up freshness is enforced by the `requireStepUp` macro).
            let identity: RegistrationIdentity;
            if (body.message && body.signature) {
                identity = {
                    type: "wallet",
                    message: body.message,
                    signature: body.signature,
                    accountId: businessSession?.accountId,
                };
            } else {
                if (!businessSession?.accountId) {
                    throw HttpError.unauthorized(
                        "UNAUTHORIZED",
                        "Walletless registration requires an authenticated account session"
                    );
                }
                identity = {
                    type: "account",
                    accountId: businessSession.accountId,
                };
            }

            if (!body.domain || !body.name || !body.defaultRewardToken) {
                throw HttpError.badRequest(
                    "MISSING_FIELDS",
                    "domain, name and defaultRewardToken are required"
                );
            }

            // The registration service honors the platform-admin options
            // (skipDomainValidation / useFrakBank / takeads link). The admin
            // decision is the canonical one (wallet allow-list OR verified
            // @frak-labs.com account email), resolved here at the BFF layer and
            // injected into the merchant domain (which must not import
            // business-auth to resolve it itself).
            const isPlatformAdmin = businessSession
                ? await isPlatformAdminAuth(businessSession)
                : false;

            // §4.10 third DNS bypass: a Shopify SSO session whose proven shop
            // domain matches the registering domain (subdomain-aware) already
            // proved ownership via OAuth. Cross-domain lookup happens here (the
            // BFF layer), never inside MerchantRegistrationService.
            const verifiedViaShopify = await isVerifiedViaShopify(
                businessSession?.accountId ?? null,
                body.domain
            );

            const { merchantId, frakBankLinked } =
                await MerchantContext.services.registration.register({
                    identity,
                    domain: body.domain,
                    name: body.name,
                    requestOrigin: origin,
                    setupCode: body.setupCode,
                    // Walletless setup codes bind to the account email
                    // (resolved here — the merchant domain can't read it).
                    ownerEmail: body.setupCode
                        ? await accountEmail(businessSession?.accountId ?? null)
                        : null,
                    defaultRewardToken: body.defaultRewardToken,
                    allowedDomains: body.allowedDomains,
                    skipDomainValidation: body.skipDomainValidation,
                    useFrakBank: body.useFrakBank,
                    isPlatformAdmin,
                    verifiedViaShopify,
                });

            await onMerchantRegistered({
                merchantId,
                frakBankLinked,
                isPlatformAdmin,
                takeads: body.takeads,
            });

            return { merchantId, verifiedViaShopify };
        },
        {
            // Merchant mint is a sensitive action (§4.8): fresh 2FA required.
            // Embedded Shopify sessions are exempt inside the macro (§4.11).
            requireStepUp: true,
            body: t.Object({
                // SIWE ownership proof — optional: walletless accounts
                // register through their step-up-verified session instead.
                message: t.Optional(t.String()),
                signature: t.Optional(t.Hex()),
                // Optional here at the schema level: required for the
                // wallet/account paths (checked at runtime, §4.10), but the
                // §4.12 embedded-mint path derives the domain from the
                // Shopify token and never reads this field.
                domain: t.Optional(t.String()),
                name: t.Optional(t.String()),
                setupCode: t.Optional(t.String()),
                defaultRewardToken: t.Optional(t.Hex()),
                allowedDomains: t.Optional(t.Array(t.String())),
                // §4.12 inline embedded mint only: the storefront's primary
                // domain, when it differs from the token's myshopify domain.
                // Registers under `primaryDomain` (with the myshopify domain
                // added to `allowedDomains`) only when it matches the
                // authenticated shop per `matchesShopDomain` — otherwise falls
                // back to registering under the myshopify domain alone, so an
                // unrelated/unverified custom domain can never be claimed
                // through this identity.
                primaryDomain: t.Optional(t.String()),
                // §4.12 inline embedded mint only: shop's preferred currency,
                // mapped to the matching Frak stablecoin server-side.
                currency: t.Optional(
                    t.Union([
                        t.Literal("usd"),
                        t.Literal("eur"),
                        t.Literal("gbp"),
                    ])
                ),
                // Platform-admin only (ignored otherwise): skip the DNS
                // ownership check, and/or link the brand to the shared Frak
                // campaign bank instead of deploying a dedicated one.
                skipDomainValidation: t.Optional(t.Boolean()),
                useFrakBank: t.Optional(t.Boolean()),
                // Platform-admin only (ignored otherwise): link this merchant
                // to a TakeAds catalog brand so per-user share links and
                // conversion ingestion can resolve it.
                takeads: t.Optional(
                    t.Object({
                        takeadsMerchantId: t.Integer(),
                        trackingLink: t.String(),
                    })
                ),
            }),
            response: {
                200: t.Object({
                    merchantId: t.String(),
                    // Drives the "Domain verified thanks to your Shopify
                    // session" banner (§4.10) instead of the DNS TXT flow.
                    verifiedViaShopify: t.Boolean(),
                }),
                400: t.ErrorResponse,
                401: StepUpRequired401,
                409: t.ErrorResponse,
            },
        }
    );

/**
 * Does the session's account hold a Shopify identity whose shop domain
 * matches (or is a subdomain match of) the domain being registered? An
 * account holds at most one Shopify identity (§4.3).
 */
/**
 * Resolve the account's email for the walletless setup-code path (the code
 * binds to it). Kept at the BFF layer since the merchant domain must not read
 * business-auth state.
 */
async function accountEmail(accountId: string | null): Promise<string | null> {
    if (!accountId) return null;
    const account =
        await BusinessAuthContext.repositories.account.findById(accountId);
    return account?.email ?? null;
}

async function isVerifiedViaShopify(
    accountId: string | null,
    registeringDomain: string
): Promise<boolean> {
    if (!accountId) return false;
    const account =
        await BusinessAuthContext.repositories.account.findById(accountId);
    if (!account?.shopifyShopDomain) return false;
    const normalizedDomain =
        MerchantContext.repositories.dnsCheck.getNormalizedDomain(
            registeringDomain
        );
    return matchesShopDomain(normalizedDomain, account.shopifyShopDomain);
}

const CURRENCY_TO_STABLECOIN: Record<"usd" | "eur" | "gbp", Stablecoin> = {
    usd: "usdc",
    eur: "eure",
    gbp: "gbpe",
};

type ShopifySessionRegistration = {
    shopDomain: string;
    shopifyUserId: string;
    email: string | null;
    name?: string;
    currency?: "usd" | "eur" | "gbp";
    primaryDomain?: string;
    takeads?: {
        takeadsMerchantId: number;
        trackingLink: string;
    };
};

/**
 * §4.12: shape the inline embedded-mint identity from the already-verified
 * App Bridge session (verified once by `businessSessionContext`, §2.3), or
 * `null` when there is no (valid) Shopify session — the caller falls through
 * to the normal wallet/account branches in that case.
 */
function resolveShopifySessionIdentity(
    session: ShopifySessionToken | null,
    body: {
        name?: string;
        currency?: "usd" | "eur" | "gbp";
        primaryDomain?: string;
        takeads?: {
            takeadsMerchantId: number;
            trackingLink: string;
        };
    }
): ShopifySessionRegistration | null {
    if (!session) return null;

    const shopDomain = extractShopDomain(session.dest);
    if (!shopDomain) return null;

    return {
        shopDomain,
        shopifyUserId: session.sub,
        // The App Bridge token carries no email claim — the account is
        // upserted without one; an email can be added later via the
        // standalone-dashboard SSO login or the password-linking flow.
        email: null,
        name: body.name,
        currency: body.currency,
        primaryDomain: body.primaryDomain,
        takeads: body.takeads,
    };
}

/**
 * §4.12 domain selection (C1 / plan §1.1). Decides which domain the embedded
 * merchant registers under and which domains alias it for resolution:
 *  - primary domain verifiably the same shop (subdomain-aware, §4.10) →
 *    register under it, alias the myshopify domain;
 *  - primary domain is a real (unverifiable) custom domain → register under
 *    the myshopify domain so it can't be *claimed*, but alias the custom
 *    domain (the Shopify app keys resolution on `primaryDomain.host`, so
 *    without this a custom-domain merchant is orphaned forever);
 *  - no distinct primary domain → myshopify domain, no alias.
 * Aliases are resolution-only (`findByAllowedDomain` is exact-match) and
 * grant no domain ownership.
 */
function resolveEmbeddedMintDomains(
    shopDomain: string,
    primaryDomain: string | undefined
): { registrationDomain: string; allowedDomains: string[] | undefined } {
    const dnsCheck = MerchantContext.repositories.dnsCheck;
    const normalizedShopDomain = dnsCheck.getNormalizedDomain(shopDomain);

    const normalizedPrimaryDomain = primaryDomain
        ? dnsCheck.getNormalizedDomain(primaryDomain)
        : null;
    const customDomain =
        normalizedPrimaryDomain !== null &&
        normalizedPrimaryDomain !== normalizedShopDomain
            ? normalizedPrimaryDomain
            : null;

    const usePrimaryDomain =
        customDomain !== null &&
        matchesShopDomain(customDomain, normalizedShopDomain);

    if (usePrimaryDomain) {
        return {
            registrationDomain: customDomain,
            allowedDomains: [normalizedShopDomain],
        };
    }
    return {
        registrationDomain: normalizedShopDomain,
        allowedDomains: customDomain !== null ? [customDomain] : undefined,
    };
}

/**
 * §4.12 inline embedded mint: register (or resolve, on a 409 race) the
 * merchant for an embedded Shopify caller — no wallet, no business session,
 * no DNS TXT, no popup. See design doc §4.12 for the full rationale.
 */
async function registerFromShopifySession(
    params: ShopifySessionRegistration
): Promise<{ merchantId: string; verifiedViaShopify: boolean }> {
    const account =
        await BusinessAuthContext.services.account.upsertShopifyAccount({
            shopifyUserId: params.shopifyUserId,
            shopDomain: params.shopDomain,
            email: params.email,
        });

    const { registrationDomain, allowedDomains } = resolveEmbeddedMintDomains(
        params.shopDomain,
        params.primaryDomain
    );

    const defaultRewardToken = getTokenAddressForStablecoin(
        CURRENCY_TO_STABLECOIN[params.currency ?? "eur"]
    );

    let merchantId: string;
    let frakBankLinked: boolean;
    try {
        const result = await MerchantContext.services.registration.register({
            identity: {
                type: "shopify-session",
                accountId: account.id,
                // The service enforces an EXACT match between `domain` and
                // `identity.shopDomain` (it must not itself reason about
                // subdomains — that would mean importing business-auth's
                // `matchesShopDomain` into the merchant domain, a cross-domain
                // import the flow rules forbid). The subdomain-aware decision
                // already happened above when picking `registrationDomain`,
                // so the identity is stamped with that same resolved domain.
                shopDomain: registrationDomain,
            },
            domain: registrationDomain,
            name: params.name ?? registrationDomain,
            requestOrigin: "",
            defaultRewardToken,
            allowedDomains,
        });
        merchantId = result.merchantId;
        frakBankLinked = result.frakBankLinked;
    } catch (error) {
        // Race between two shop admins hitting "Connect" at once (or a
        // re-install after a previous successful registration): resolve to
        // the existing merchant instead of surfacing an error the embedded
        // UI can't do anything useful with (§4.12 edge cases).
        if (error instanceof HttpError && error.status === 409) {
            const existing =
                await MerchantContext.repositories.merchant.findByDomain(
                    registrationDomain
                );
            if (existing) {
                return { merchantId: existing.id, verifiedViaShopify: true };
            }
        }
        throw error;
    }

    await onMerchantRegistered({
        merchantId,
        frakBankLinked,
        isPlatformAdmin: false,
        takeads: params.takeads,
    });

    return { merchantId, verifiedViaShopify: true };
}

/**
 * Shared post-registration side effects (affiliate brand link + bank
 * deploy), factored out so both the wallet/account path and the §4.12
 * embedded-session path trigger them identically.
 */
async function onMerchantRegistered(params: {
    merchantId: string;
    frakBankLinked: boolean;
    isPlatformAdmin: boolean;
    takeads?: {
        takeadsMerchantId: number;
        trackingLink: string;
    };
}): Promise<void> {
    const { merchantId, frakBankLinked, isPlatformAdmin, takeads } = params;
    const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

    // Link the merchant to its affiliate brand (platform admin only) so
    // share-link generation + conversion ingestion can resolve it.
    // Non-fatal: the merchant is already created, so a link failure must not
    // strand it behind a 409-on-retry — we log and move on.
    if (isPlatformAdmin && takeads) {
        const externalId = String(takeads.takeadsMerchantId);
        try {
            await AffiliateContext.services.affiliateLink.registerBrand({
                merchantId,
                externalId,
                trackingLink: takeads.trackingLink,
            });
        } catch (error) {
            log.error(
                { merchantId, externalId, error: msgOf(error) },
                "Failed to link affiliate brand during registration"
            );
        }
    }

    // Frak-bank merchants reuse the shared bank; everyone else gets a
    // dedicated per-merchant bank.
    if (!frakBankLinked) {
        CampaignBankContext.services.campaignBank
            .deployAndSetupBank(merchantId)
            .catch((error) => {
                log.error(
                    { merchantId, error: msgOf(error) },
                    "Failed to deploy campaign bank during registration"
                );
            });
    }
}
