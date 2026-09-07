import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AttributionContext } from "../../../domain/attribution/context";
import {
    resolveSdkIdentity,
    sdkIdentityHeaderSchema,
} from "../track/sdkIdentity";

export const merchantReferralStatusRoute = new Elysia().get(
    "/referral-status",
    async ({ headers, query }) => {
        const merchantId = query.merchantId;

        // Resolve identity from SDK headers
        const identityResult = await resolveSdkIdentity({
            headers,
            merchantId,
        });

        if (!identityResult.success) {
            return status(identityResult.statusCode, {
                success: false,
                error: identityResult.error,
            });
        }

        const { identityGroupId } = identityResult;

        // Check if the user has a referral link as referee for this merchant
        const referralLink =
            await AttributionContext.repositories.referralLink.findByReferee({
                merchantId,
                refereeIdentityGroupId: identityGroupId,
                scope: "merchant",
            });

        return {
            isReferred: referralLink !== null,
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        query: t.Object({
            merchantId: t.String({ format: "uuid" }),
        }),
        response: {
            200: t.Object({
                isReferred: t.Boolean(),
            }),
            // `resolveSdkIdentity` only ever fails with 400 (client id given
            // without a merchantId) or 401 (no usable identity header). Its
            // error body carries no `code`, so `t.ErrorResponse` minus that
            // field is the exact shape — declaring the full one would make
            // Elysia reject every real error response with a 422.
            400: t.Omit(t.ErrorResponse, ["code"]),
            401: t.Omit(t.ErrorResponse, ["code"]),
        },
    }
);
