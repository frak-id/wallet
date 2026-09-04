import { t } from "@backend-utils";
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
            identityGroupId,
            interactionLogId: result.interactionLog?.id ?? null,
            isDuplicate: result.isDuplicate,
            ...buildTypeSpecificResponse(body.type, result),
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: InteractionSubmissionSchema,
        response: {
            200: t.Object({
                identityGroupId: t.String(),
                interactionLogId: t.Union([t.String(), t.Null()]),
                // Part of the published response contract for Eden/HTTP consumers, so it
                // must stay in the schema — undeclared properties are stripped from the
                // response by Elysia, not just undocumented. The native SDKs read only the
                // status code, so nothing there depends on it.
                isDuplicate: t.Boolean(),
                // Only `buildTypeSpecificResponse("arrival", …)` contributes a
                // field, and it is null when no referral link was registered.
                // `sharing` and `custom` add nothing, hence optional.
                referralLinkId: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            // 400: `resolveSdkIdentity` saw a client id with no merchantId, or
            // `validateArrivalReferrer` rejected the referrer fields.
            // 401: no usable identity header / unverifiable wallet JWT.
            // Neither error body carries a `code`, so the shared
            // `t.ErrorResponse` is narrowed rather than used as-is.
            400: t.Omit(t.ErrorResponse, ["code"]),
            401: t.Omit(t.ErrorResponse, ["code"]),
        },
    }
);

function buildTypeSpecificResponse(
    type: "arrival" | "sharing" | "custom",
    result: Record<string, unknown>
): Record<string, unknown> {
    switch (type) {
        case "arrival":
            return {
                referralLinkId: result.referralLinkId,
            };
        case "sharing":
            return {};
        case "custom":
            return {};
        default:
            return {};
    }
}
