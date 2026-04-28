import { rateLimitMiddleware } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { MerchantContext } from "../../../domain/merchant/context";

const installCodeGenerateRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/generate",
        async ({ body }) => {
            const result = await IdentityContext.services.installCode.generate({
                merchantId: body.merchantId,
                anonymousId: body.anonymousId,
            });
            return {
                code: result.code,
                expiresAt: new Date(result.expiresAt).toISOString(),
            };
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.String(),
            }),
            response: {
                200: t.Object({
                    code: t.String(),
                    expiresAt: t.String(),
                }),
            },
        }
    );

const installCodeResolveRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/resolve",
        async ({ body }) => {
            const { merchantId, anonymousId } =
                await IdentityContext.services.installCode.resolve({
                    code: body.code,
                });

            const [merchant, identityGroup] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                IdentityContext.repositories.identity.findGroupByIdentity({
                    type: "anonymous_fingerprint",
                    value: anonymousId,
                    merchantId,
                }),
            ]);

            if (!merchant) {
                throw HttpError.notFound(
                    "MERCHANT_NOT_FOUND",
                    "Merchant not found"
                );
            }

            let hasWallet = false;
            if (identityGroup) {
                const wallet =
                    await IdentityContext.repositories.identity.getWalletForGroup(
                        identityGroup.id
                    );
                hasWallet = wallet !== null;
            }

            return {
                merchantId,
                anonymousId,
                merchant: {
                    name: merchant.name,
                    domain: merchant.domain,
                },
                hasWallet,
            };
        },
        {
            body: t.Object({
                code: t.String(),
            }),
            response: {
                200: t.Object({
                    merchantId: t.String(),
                    anonymousId: t.String(),
                    merchant: t.Object({
                        name: t.String(),
                        domain: t.String(),
                    }),
                    hasWallet: t.Boolean(),
                }),
                404: t.ErrorResponse,
            },
        }
    );

export const installCodeRoutes = new Elysia({ prefix: "/install-code" })
    .use(installCodeGenerateRoute)
    .use(installCodeResolveRoute);
