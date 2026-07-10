import { log } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AffiliateContext } from "../../../domain/affiliate";
import { AuthContext } from "../../../domain/auth";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { MerchantContext } from "../../../domain/merchant";
import type { RegistrationIdentity } from "../../../domain/merchant/services/MerchantRegistrationService";
import type { DnsProofOwner } from "../../../infrastructure/dns/DnsCheckRepository";
import type { ResolvedBusinessAuth } from "../middleware/resolveBusinessAuth";
import {
    businessSessionContext,
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
                return { isDomainValid: false, isAlreadyRegistered: false };
            }

            const dnsCheck = MerchantContext.repositories.dnsCheck;
            const normalizedDomain = dnsCheck.getNormalizedDomain(domain);

            const isDomainValid = await dnsCheck.isValidDomain({
                domain: normalizedDomain,
                owner,
                setupCode,
            });

            const existingMerchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    normalizedDomain
                );

            return {
                isDomainValid,
                isAlreadyRegistered: existingMerchant !== null,
            };
        },
        {
            query: t.Object({
                domain: t.String(),
                setupCode: t.Optional(t.String()),
            }),
            response: t.Object({
                isDomainValid: t.Boolean(),
                isAlreadyRegistered: t.Boolean(),
            }),
        }
    )
    .post(
        "",
        async ({ body, request, businessSession }) => {
            const origin = request.headers.get("origin") ?? "";

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

            // The registration service honors the platform-admin options
            // (skipDomainValidation / useFrakBank) and co-admins the team only
            // when the SIWE signer is one of these wallets.
            const platformAdminWallets =
                AuthContext.services.platformAdmin.getAdminWallets();

            const { merchantId, frakBankLinked, isPlatformAdmin } =
                await MerchantContext.services.registration.register({
                    identity,
                    domain: body.domain,
                    name: body.name,
                    requestOrigin: origin,
                    setupCode: body.setupCode,
                    defaultRewardToken: body.defaultRewardToken,
                    allowedDomains: body.allowedDomains,
                    skipDomainValidation: body.skipDomainValidation,
                    useFrakBank: body.useFrakBank,
                    platformAdminWallets,
                });

            // Link the merchant to its affiliate brand (platform admin only) so
            // share-link generation + conversion ingestion can resolve it.
            // Non-fatal: the merchant is already created, so a link failure
            // must not strand it behind a 409-on-retry — we log and move on.
            const msgOf = (e: unknown) =>
                e instanceof Error ? e.message : String(e);

            if (isPlatformAdmin && body.takeads) {
                const externalId = String(body.takeads.takeadsMerchantId);
                try {
                    await AffiliateContext.services.affiliateLink.registerBrand(
                        {
                            merchantId,
                            externalId,
                            trackingLink: body.takeads.trackingLink,
                        }
                    );
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

            return { merchantId };
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
                domain: t.String(),
                name: t.String(),
                setupCode: t.Optional(t.String()),
                defaultRewardToken: t.Hex(),
                allowedDomains: t.Optional(t.Array(t.String())),
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
                }),
                400: t.ErrorResponse,
                401: StepUpRequired401,
                409: t.ErrorResponse,
            },
        }
    );
