import { Elysia, status, t } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import { resolveSdkIdentity, sdkIdentityHeaderSchema } from "./sdkIdentity";

const trackSharingBodySchema = t.Object({
    merchantId: t.String({ format: "uuid" }),
});

export const trackSharingRoute = new Elysia().post(
    "/sharing",
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

        if (!walletAddress) {
            return status(400, {
                success: false,
                error: "Wallet address required for sharing tracking",
            });
        }

        const result =
            await OrchestrationContext.orchestrators.interactionSubmission.submit(
                {
                    type: "sharing",
                    merchantId: body.merchantId,
                },
                { identityGroupId, walletAddress }
            );

        return {
            success: true,
            identityGroupId,
            interactionLogId: result.interactionLog?.id ?? null,
            isDuplicate: result.isDuplicate,
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: trackSharingBodySchema,
    }
);
