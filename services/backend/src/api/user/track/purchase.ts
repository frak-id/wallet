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
        response: {
            // Mirrors `ClaimPurchaseResult`: the two arms of `claimPurchase`
            // return disjoint optional fields — `pendingWebhook` when only a
            // claim row was written, `purchaseId` + `merged` when an existing
            // purchase was reconciled.
            200: t.Object({
                success: t.Boolean(),
                identityGroupId: t.String(),
                purchaseId: t.Optional(t.String()),
                pendingWebhook: t.Optional(t.Boolean()),
                merged: t.Optional(t.Boolean()),
            }),
            // 400 covers both the `resolveSdkIdentityNodes` failure (client id
            // without a merchantId) and the explicit guard below it: the body
            // schema marks `merchantId` optional because a wallet-JWT caller
            // need not send it, but the claim itself cannot proceed without
            // one. 401 is the no-usable-identity case. Neither body carries a
            // `code`, so `t.ErrorResponse` is narrowed to match exactly.
            400: t.Omit(t.ErrorResponse, ["code"]),
            401: t.Omit(t.ErrorResponse, ["code"]),
        },
    }
);
