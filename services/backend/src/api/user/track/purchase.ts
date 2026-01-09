import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { type Address, isAddress, isHex } from "viem";
import { OrchestrationContext } from "../../../orchestration/context";

const purchaseBodySchema = t.Object({
    customerId: t.Union([t.String(), t.Number()]),
    orderId: t.Union([t.String(), t.Number()]),
    token: t.String(),
    merchantId: t.Optional(t.String({ format: "uuid" })),
});

export const trackPurchaseRoute = new Elysia().post(
    "/purchase",
    async ({ headers, body }) => {
        const clientId = headers["x-frak-client-id"];
        const walletSdkAuth = headers["x-wallet-sdk-auth"];

        const customerId =
            typeof body.customerId === "string"
                ? body.customerId
                : body.customerId.toString();
        const orderId =
            typeof body.orderId === "string"
                ? body.orderId
                : body.orderId.toString();

        if (clientId) {
            if (!body.merchantId) {
                return status(400, {
                    success: false,
                    error: "merchantId required when using x-frak-client-id",
                });
            }

            log.debug(
                { clientId, customerId, orderId },
                "Linking purchase via clientId"
            );

            const result =
                await OrchestrationContext.orchestrators.purchaseLinking.linkPurchaseFromSdk(
                    {
                        clientId,
                        merchantId: body.merchantId,
                        customerId,
                        orderId,
                        token: body.token,
                    }
                );

            return result;
        }

        if (walletSdkAuth) {
            let address: Address;

            if (isHex(walletSdkAuth) && isAddress(walletSdkAuth)) {
                address = walletSdkAuth;
            } else {
                const session =
                    await JwtContext.walletSdk.verify(walletSdkAuth);
                if (!session) {
                    return status(401, {
                        success: false,
                        error: "Invalid wallet SDK JWT",
                    });
                }
                address = session.address;
            }

            log.debug(
                { wallet: address, customerId, orderId },
                "Linking purchase via wallet"
            );

            const result =
                await OrchestrationContext.orchestrators.purchaseLinking.linkPurchaseFromWallet(
                    {
                        wallet: address,
                        merchantId: body.merchantId,
                        clientId: headers["x-frak-client-id"],
                        customerId,
                        orderId,
                        token: body.token,
                    }
                );

            return result;
        }

        return status(401, {
            success: false,
            error: "x-frak-client-id or x-wallet-sdk-auth header required",
        });
    },
    {
        headers: t.Partial(
            t.Object({
                "x-frak-client-id": t.String(),
                // For legacy version
                "x-wallet-sdk-auth": t.String(),
            })
        ),
        body: purchaseBodySchema,
    }
);
