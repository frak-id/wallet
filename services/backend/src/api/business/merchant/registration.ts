import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { MerchantContext } from "../../../domain/merchant";
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

            const { merchantId } =
                await MerchantContext.services.registration.register({
                    message: body.message,
                    signature: body.signature,
                    domain: body.domain,
                    name: body.name,
                    requestOrigin: origin,
                    setupCode: body.setupCode,
                    defaultRewardToken: body.defaultRewardToken,
                    allowedDomains: body.allowedDomains,
                });

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
            }),
            response: {
                200: t.Object({
                    merchantId: t.String(),
                }),
                400: t.ErrorResponse,
                409: t.ErrorResponse,
            },
        }
    )
    .get(
        "/statement",
        async ({ query: { domain }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const statement =
                MerchantContext.services.registration.buildRegistrationStatement(
                    domain,
                    businessSession.wallet
                );

            return { statement };
        },
        {
            query: t.Object({
                domain: t.String(),
            }),
            response: {
                200: t.Object({
                    statement: t.String(),
                }),
                401: t.String(),
            },
        }
    );
