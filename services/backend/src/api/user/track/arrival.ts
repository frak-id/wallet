import { Elysia, status, t } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import { resolveSdkIdentity, sdkIdentityHeaderSchema } from "./sdkIdentity";

const trackArrivalBodySchema = t.Object({
    merchantId: t.String({ format: "uuid" }),
    referrerWallet: t.Optional(t.String()),
    landingUrl: t.Optional(t.String()),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
});

export const trackArrivalRoute = new Elysia().post(
    "/arrival",
    async ({ headers, body }) => {
        const identityResult = await resolveSdkIdentity({
            headers,
            merchantId: body.merchantId,
        });

        if (!identityResult.success) {
            return status(identityResult.statusCode, {
                success: false,
                error: identityResult.error,
            });
        }

        const { identityGroupId, walletAddress } = identityResult;

        const result =
            await OrchestrationContext.orchestrators.interactionSubmission.submit(
                {
                    type: "arrival",
                    ...body,
                },
                { identityGroupId, walletAddress }
            );

        return {
            success: true,
            identityGroupId,
            touchpointId: result.touchpointId,
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: trackArrivalBodySchema,
    }
);
