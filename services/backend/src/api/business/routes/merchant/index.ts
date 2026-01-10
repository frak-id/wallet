import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";
import { merchantAdminsRoutes } from "./admins";
import { merchantCampaignsRoutes } from "./campaigns";
import { merchantRegistrationRoutes } from "./registration";
import { merchantTransferRoutes } from "./transfer";
import { merchantWebhooksRoutes } from "./webhooks";

export const merchantRoutes = new Elysia({ prefix: "/merchant" })
    .use(merchantRegistrationRoutes)
    .use(businessSessionContext)
    .get(
        "/:merchantId",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const access =
                await MerchantContext.services.authorization.checkAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!access.hasAccess) {
                return status(403, "Access denied");
            }

            return {
                id: merchant.id,
                domain: merchant.domain,
                name: merchant.name,
                ownerWallet: merchant.ownerWallet,
                bankAddress: merchant.bankAddress,
                config: merchant.config,
                verifiedAt: merchant.verifiedAt?.toISOString() ?? null,
                createdAt: merchant.createdAt?.toISOString() ?? null,
                role: access.role,
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    id: t.String(),
                    domain: t.String(),
                    name: t.String(),
                    ownerWallet: t.Hex(),
                    bankAddress: t.Union([t.Hex(), t.Null()]),
                    config: t.Union([t.Object({}), t.Null()]),
                    verifiedAt: t.Union([t.String(), t.Null()]),
                    createdAt: t.Union([t.String(), t.Null()]),
                    role: t.Union([
                        t.Literal("owner"),
                        t.Literal("admin"),
                        t.Literal("none"),
                    ]),
                }),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .get(
        "/my",
        async ({ businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const owned =
                await MerchantContext.repositories.merchant.findByOwnerWallet(
                    businessSession.wallet
                );

            const adminOf =
                await MerchantContext.repositories.merchantAdmin.findByWallet(
                    businessSession.wallet
                );

            const adminMerchantIds = adminOf.map((a) => a.merchantId);
            const adminMerchants = await Promise.all(
                adminMerchantIds.map((id) =>
                    MerchantContext.repositories.merchant.findById(id)
                )
            );

            return {
                owned: owned.map((m) => ({
                    id: m.id,
                    domain: m.domain,
                    name: m.name,
                })),
                adminOf: adminMerchants
                    .filter((m) => m !== null)
                    .map((m) => ({
                        id: m.id,
                        domain: m.domain,
                        name: m.name,
                    })),
            };
        },
        {
            response: {
                200: t.Object({
                    owned: t.Array(
                        t.Object({
                            id: t.String(),
                            domain: t.String(),
                            name: t.String(),
                        })
                    ),
                    adminOf: t.Array(
                        t.Object({
                            id: t.String(),
                            domain: t.String(),
                            name: t.String(),
                        })
                    ),
                }),
                401: t.String(),
            },
        }
    )
    .use(merchantAdminsRoutes)
    .use(merchantTransferRoutes)
    .use(merchantCampaignsRoutes)
    .use(merchantWebhooksRoutes);
