import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    buildIdentityNodes,
    resolveWalletAddress,
    sdkIdentityHeaderSchema,
} from "./sdkIdentity";

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
        const merchantId = body.merchantId;

        const customerId =
            typeof body.customerId === "string"
                ? body.customerId
                : body.customerId.toString();
        const orderId =
            typeof body.orderId === "string"
                ? body.orderId
                : body.orderId.toString();

        let walletAddress: Address | undefined;
        if (walletSdkAuth) {
            const resolved = await resolveWalletAddress(walletSdkAuth);
            if (!resolved) {
                return status(401, {
                    success: false,
                    error: "Invalid wallet SDK JWT",
                });
            }
            walletAddress = resolved;
        }

        const identityNodes = buildIdentityNodes({
            walletAddress,
            clientId,
            merchantId,
        });

        if (identityNodes.length === 0) {
            if (clientId && !merchantId) {
                return status(400, {
                    success: false,
                    error: "merchantId required when using x-frak-client-id",
                });
            }
            return status(401, {
                success: false,
                error: "x-frak-client-id or x-wallet-sdk-auth header required",
            });
        }

        if (!merchantId) {
            return status(400, {
                success: false,
                error: "merchantId is required",
            });
        }

        log.debug(
            { customerId, orderId, nodeCount: identityNodes.length },
            "Claiming purchase"
        );

        const result =
            await OrchestrationContext.orchestrators.purchaseLinking.claimPurchase(
                {
                    identityNodes,
                    merchantId,
                    customerId,
                    orderId,
                    token: body.token,
                }
            );

        return result;
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: purchaseBodySchema,
    }
);
