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
    }
);
