import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    type InteractionSubmission,
    InteractionSubmissionSchema,
    validateArrivalReferrer,
} from "../../schemas";
import { resolveSdkIdentity, sdkIdentityHeaderSchema } from "./sdkIdentity";

export const trackInteractionRoute = new Elysia().post(
    "/interaction",
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

        if (body.type === "arrival") {
            const referrerError = validateArrivalReferrer(body);
            if (referrerError) {
                return status(400, {
                    success: false,
                    error: referrerError,
                });
            }
        }

        const result =
            await OrchestrationContext.orchestrators.interactionSubmission.submit(
                body as InteractionSubmission,
                {
                    identityGroupId,
                    walletAddress,
                }
            );

        return {
            success: true,
            identityGroupId,
            interactionLogId: result.interactionLog?.id ?? null,
            isDuplicate: result.isDuplicate,
            ...buildTypeSpecificResponse(body.type, result),
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: InteractionSubmissionSchema,
    }
);

function buildTypeSpecificResponse(
    type: "arrival" | "sharing" | "custom",
    result: Record<string, unknown>
): Record<string, unknown> {
    switch (type) {
        case "arrival":
            return {
                touchpointId: result.touchpointId,
            };
        case "sharing":
            return {};
        case "custom":
            return {};
        default:
            return {};
    }
}
