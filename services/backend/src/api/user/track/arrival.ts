import { Elysia, status, t } from "elysia";
import type { Address } from "viem";
import { isAddress } from "viem";
import {
    AttributionContext,
    type TouchpointSourceData,
} from "../../../domain/attribution";
import { IdentityContext } from "../../../domain/identity";
import { resolveSdkIdentity, sdkIdentityHeaderSchema } from "./sdkIdentity";

async function resolveReferrerGroupId(
    referrerWallet: string | undefined
): Promise<string | undefined> {
    if (!referrerWallet || !isAddress(referrerWallet)) {
        return undefined;
    }
    const group =
        await IdentityContext.repositories.identity.findGroupByIdentity({
            type: "wallet",
            value: referrerWallet,
        });
    return group?.id ?? undefined;
}

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

        const { identityGroupId } = identityResult;

        const sourceData = buildSourceData(body);

        const referrerIdentityGroupId = await resolveReferrerGroupId(
            body.referrerWallet
        );

        const touchpoint =
            await AttributionContext.services.attribution.recordTouchpoint({
                identityGroupId,
                merchantId: body.merchantId,
                source: sourceData.type,
                sourceData,
                landingUrl: body.landingUrl,
                referrerIdentityGroupId,
            });

        return {
            success: true,
            identityGroupId,
            touchpointId: touchpoint.id,
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: trackArrivalBodySchema,
    }
);

function buildSourceData(body: {
    referrerWallet?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
}): TouchpointSourceData {
    if (body.referrerWallet && isAddress(body.referrerWallet)) {
        return {
            type: "referral_link",
            referrerWallet: body.referrerWallet as Address,
        };
    }

    if (body.utmSource || body.utmMedium || body.utmCampaign) {
        return {
            type: "paid_ad",
            utmSource: body.utmSource,
            utmMedium: body.utmMedium,
            utmCampaign: body.utmCampaign,
            utmTerm: body.utmTerm,
            utmContent: body.utmContent,
        };
    }

    return { type: "direct" };
}
