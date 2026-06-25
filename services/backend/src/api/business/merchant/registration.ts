import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../domain/auth";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { MerchantContext } from "../../../domain/merchant";
import { TakeadsContext } from "../../../domain/takeads";
import { businessSessionContext } from "../middleware/session";

export const merchantRegistrationRoutes = new Elysia({ prefix: "/register" })
    .use(businessSessionContext)
    .get(
        "/dns-txt",
        async ({ query: { domain }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const dnsTxt =
                MerchantContext.services.registration.getDnsTxtString(
                    domain,
                    businessSession.wallet
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
            if (!businessSession) {
                return { isDomainValid: false, isAlreadyRegistered: false };
            }

            const dnsCheck = MerchantContext.repositories.dnsCheck;
            const normalizedDomain = dnsCheck.getNormalizedDomain(domain);

            const isDomainValid = await dnsCheck.isValidDomain({
                domain: normalizedDomain,
                owner: businessSession.wallet,
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
        async ({ body, request }) => {
            const origin = request.headers.get("origin") ?? "";

            // The registration service honors the platform-admin options
            // (skipDomainValidation / useFrakBank) and co-admins the team only
            // when the SIWE signer is one of these wallets.
            const platformAdminWallets =
                AuthContext.services.platformAdmin.getAdminWallets();

            const { merchantId, frakBankLinked, isPlatformAdmin } =
                await MerchantContext.services.registration.register({
                    message: body.message,
                    signature: body.signature,
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

            // Link the merchant to its TakeAds brand (platform admin only) so
            // share-link generation + conversion ingestion can resolve it.
            // Non-fatal: the merchant is already created, so a link failure
            // must not strand it behind a 409-on-retry — we log and move on.
            if (isPlatformAdmin && body.takeads) {
                const { takeadsMerchantId, trackingLink } = body.takeads;
                try {
                    const existing =
                        await TakeadsContext.repositories.takeadsMerchant.findByTakeadsMerchantId(
                            takeadsMerchantId
                        );
                    if (existing && existing.merchantId !== merchantId) {
                        log.warn(
                            { merchantId, takeadsMerchantId },
                            "TakeAds brand already linked to another merchant; skipping link"
                        );
                    } else {
                        await TakeadsContext.repositories.takeadsMerchant.link({
                            merchantId,
                            takeadsMerchantId,
                            trackingLink,
                        });
                    }
                } catch (error) {
                    log.error(
                        {
                            merchantId,
                            takeadsMerchantId,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                        "Failed to link TakeAds brand during registration"
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
                            {
                                merchantId,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            },
                            "Failed to deploy campaign bank during registration"
                        );
                    });
            }

            return { merchantId };
        },
        {
            body: t.Object({
                message: t.String(),
                signature: t.Hex(),
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
                409: t.ErrorResponse,
            },
        }
    );
