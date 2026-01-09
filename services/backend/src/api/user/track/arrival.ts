import { Elysia, t } from "elysia";
import type { Address } from "viem";
import { isAddress } from "viem";
import {
    AttributionContext,
    type TouchpointSourceData,
} from "../../../domain/attribution";
import { IdentityContext } from "../../../domain/identity";

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
        const clientId = headers["x-frak-client-id"];
        if (!clientId) {
            return {
                success: false,
                error: "x-frak-client-id header required",
            };
        }

        const identityService = IdentityContext.services.identityResolution;
        const attributionService = AttributionContext.services.attribution;

        const { identityGroupId } = await identityService.resolveAnonymousId({
            anonId: clientId,
            merchantId: body.merchantId,
        });

        const sourceData = buildSourceData(body);

        const touchpoint = await attributionService.recordTouchpoint({
            identityGroupId,
            merchantId: body.merchantId,
            source: sourceData.type,
            sourceData,
            landingUrl: body.landingUrl,
        });

        return {
            success: true,
            identityGroupId,
            touchpointId: touchpoint.id,
        };
    },
    {
        headers: t.Object({
            "x-frak-client-id": t.String({ minLength: 1 }),
        }),
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
