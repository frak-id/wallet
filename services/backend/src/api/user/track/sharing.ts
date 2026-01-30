import { eventEmitter, log } from "@backend-infrastructure";
import { Elysia, status, t } from "elysia";
import type { Address } from "viem";
import { RewardsContext } from "../../../domain/rewards/context";
import type { CreateReferralLinkPayload } from "../../../domain/rewards/types";
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

        const payload: CreateReferralLinkPayload = {
            sharerWallet: walletAddress as Address,
            merchantId: body.merchantId,
        };

        const externalEventId = `create_referral_link:${identityGroupId}:${body.merchantId}:${Date.now()}`;
        const interactionLog =
            await RewardsContext.repositories.interactionLog.createIdempotent({
                type: "create_referral_link",
                identityGroupId,
                merchantId: body.merchantId,
                externalEventId,
                payload,
            });

        if (!interactionLog) {
            return {
                success: true,
                identityGroupId,
                interactionLogId: null,
                isDuplicate: true,
            };
        }

        eventEmitter.emit("newInteraction", {
            type: "create_referral_link",
        });

        log.info(
            {
                identityGroupId,
                interactionLogId: interactionLog.id,
                merchantId: body.merchantId,
            },
            "Referral link creation tracked as interaction"
        );

        return {
            success: true,
            identityGroupId,
            interactionLogId: interactionLog.id,
            isDuplicate: false,
        };
    },
    {
        headers: sdkIdentityHeaderSchema,
        body: trackSharingBodySchema,
    }
);
