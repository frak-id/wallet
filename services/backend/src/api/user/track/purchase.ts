import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    resolveSdkIdentityNodes,
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
        const merchantId = body.merchantId;

        const customerId =
            typeof body.customerId === "string"
                ? body.customerId
                : body.customerId.toString();
        const orderId =
            typeof body.orderId === "string"
                ? body.orderId
                : body.orderId.toString();

        const identityResult = await resolveSdkIdentityNodes({
            headers,
            merchantId,
        });

        if (!identityResult.success) {
            return status(identityResult.statusCode, {
                success: false,
                error: identityResult.error,
            });
        }

        const { identityNodes } = identityResult;

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
                    // Reachable with an unauthenticated x-frak-client-id —
                    // never merge identity groups from here.
                    merge: false,
                }
            );

        return result;
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: purchaseBodySchema,
    }
);
