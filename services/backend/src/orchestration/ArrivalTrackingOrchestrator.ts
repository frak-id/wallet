import { eventEmitter, log } from "@backend-infrastructure";
import type { Address } from "viem";
import type {
    TouchpointSource,
    TouchpointSourceData,
} from "../domain/attribution/schemas/index";
import type { AttributionService } from "../domain/attribution/services/AttributionService";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { ReferralArrivalPayload } from "../domain/rewards/types";

type TrackArrivalParams = {
    identityGroupId: string;
    merchantId: string;
    source: TouchpointSource;
    sourceData: TouchpointSourceData;
    landingUrl?: string;
    referrerIdentityGroupId?: string;
    referrerWallet?: Address;
};

type TrackArrivalResult = {
    touchpointId: string;
    interactionLogId: string | null;
};

export class ArrivalTrackingOrchestrator {
    constructor(
        private readonly attributionService: AttributionService,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async trackArrival(
        params: TrackArrivalParams
    ): Promise<TrackArrivalResult> {
        const touchpoint = await this.attributionService.recordTouchpoint({
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            source: params.source,
            sourceData: params.sourceData,
            landingUrl: params.landingUrl,
            referrerIdentityGroupId: params.referrerIdentityGroupId,
        });

        let interactionLogId: string | null = null;

        if (params.source === "referral_link" && params.referrerWallet) {
            const payload: ReferralArrivalPayload = {
                referrerWallet: params.referrerWallet,
                landingUrl: params.landingUrl,
                touchpointId: touchpoint.id,
            };

            const externalEventId = `referral_arrival:${touchpoint.id}`;
            const interactionLog =
                await this.interactionLogRepository.createIdempotent({
                    type: "referral_arrival",
                    identityGroupId: params.identityGroupId,
                    merchantId: params.merchantId,
                    externalEventId,
                    payload,
                });

            if (interactionLog) {
                interactionLogId = interactionLog.id;
                eventEmitter.emit("newInteraction", {
                    type: "referral_arrival",
                });

                log.info(
                    {
                        touchpointId: touchpoint.id,
                        interactionLogId,
                        merchantId: params.merchantId,
                    },
                    "Referral arrival tracked as interaction"
                );
            }
        }

        return {
            touchpointId: touchpoint.id,
            interactionLogId,
        };
    }
}
