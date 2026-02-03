import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import type { InteractionSubmission } from "../../../orchestration/interaction-submission";
import { resolveSdkIdentity, sdkIdentityHeaderSchema } from "./sdkIdentity";

const arrivalSchema = t.Object({
    type: t.Literal("arrival"),
    merchantId: t.String({ format: "uuid" }),
    referrerWallet: t.Optional(t.String()),
    landingUrl: t.Optional(t.String()),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
});

const sharingSchema = t.Object({
    type: t.Literal("sharing"),
    merchantId: t.String({ format: "uuid" }),
});

const customSchema = t.Object({
    type: t.Literal("custom"),
    merchantId: t.String({ format: "uuid" }),
    customType: t.String({ minLength: 1, maxLength: 100 }),
    data: t.Optional(t.Record(t.String(), t.Unknown())),
    idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
});

const interactionSubmissionSchema = t.Union([
    arrivalSchema,
    sharingSchema,
    customSchema,
]);

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

        try {
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
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Wallet address required")) {
                    return status(400, {
                        success: false,
                        error: error.message,
                    });
                }
            }
            throw error;
        }
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: interactionSubmissionSchema,
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
