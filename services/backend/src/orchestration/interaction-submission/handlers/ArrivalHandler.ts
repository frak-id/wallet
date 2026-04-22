import type { Address } from "viem";
import { isAddress } from "viem";
import type { TouchpointSourceData } from "../../../domain/attribution";
import type { AttributionService } from "../../../domain/attribution/services/AttributionService";
import { IdentityContext } from "../../../domain/identity";
import type {
    InteractionType,
    ReferralArrivalPayload,
} from "../../../domain/rewards/types";
import type { HandlerContext, InteractionHandler } from "../types";

export type ArrivalInput = {
    merchantId: string;
    referrerWallet?: string;
    referrerClientId?: string;
    referrerMerchantId?: string;
    referralTimestamp?: number;
    landingUrl?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
};

export type ArrivalExtra = {
    touchpointId: string;
};

/**
 * Referrer identity normalized from the raw arrival input.
 *
 * `wallet` is only set when the raw input passes `isAddress`; callers can
 * therefore trust that a present `wallet` is always a valid {@link Address}.
 */
type NormalizedReferrer = {
    wallet?: Address;
    clientId?: string;
    merchantId?: string;
    timestamp?: number;
};

function normalizeReferrer(input: ArrivalInput): NormalizedReferrer {
    return {
        wallet:
            input.referrerWallet && isAddress(input.referrerWallet)
                ? (input.referrerWallet as Address)
                : undefined,
        clientId: input.referrerClientId,
        merchantId: input.referrerMerchantId,
        timestamp: input.referralTimestamp,
    };
}

export class ArrivalHandler
    implements
        InteractionHandler<ArrivalInput, ReferralArrivalPayload, ArrivalExtra>
{
    constructor(private readonly attributionService: AttributionService) {}

    getInteractionType(_input: ArrivalInput): InteractionType {
        return "referral";
    }

    buildExternalEventId(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload,
        _context: HandlerContext
    ): string {
        return `referral:${payload.touchpointId ?? Date.now()}`;
    }

    async buildPayload(
        input: ArrivalInput,
        context: HandlerContext
    ): Promise<ReferralArrivalPayload> {
        const referrer = normalizeReferrer(input);
        const sourceData = this.buildSourceData(input, referrer);
        const referrerIdentityGroupId =
            await this.resolveReferrerGroupId(referrer);

        const { touchpoint, referralRegistered } =
            await this.attributionService.recordTouchpoint({
                identityGroupId: context.identity.identityGroupId,
                merchantId: input.merchantId,
                source: sourceData.type,
                sourceData,
                landingUrl: input.landingUrl,
                referrerIdentityGroupId,
            });

        return {
            referrerWallet: referrer.wallet,
            referrerClientId: referrer.clientId,
            referrerMerchantId: referrer.merchantId,
            referralTimestamp: referrer.timestamp,
            landingUrl: input.landingUrl,
            touchpointId: touchpoint.id,
            referralRegistered,
        };
    }

    async postProcess(
        _input: ArrivalInput,
        _context: HandlerContext,
        payload: ReferralArrivalPayload
    ): Promise<ArrivalExtra> {
        return {
            touchpointId: payload?.touchpointId ?? "",
        };
    }

    /**
     * `referralRegistered === true` is only ever set by `AttributionService`
     * when the touchpoint source is `referral_link` AND a referrer identity
     * group was resolved — so it already implies a valid referral source.
     */
    shouldCreateInteractionLog(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload
    ): boolean {
        return payload.referralRegistered === true;
    }

    private buildSourceData(
        input: ArrivalInput,
        referrer: NormalizedReferrer
    ): TouchpointSourceData {
        // V2: merchantId + at least one sharer identifier (clientId or wallet).
        if (referrer.merchantId && (referrer.clientId || referrer.wallet)) {
            return {
                type: "referral_link",
                v: 2,
                referrerMerchantId: referrer.merchantId,
                referralTimestamp: referrer.timestamp,
                ...(referrer.clientId && {
                    referrerClientId: referrer.clientId,
                }),
                ...(referrer.wallet && { referrerWallet: referrer.wallet }),
            };
        }

        // V1 legacy: wallet-only (no merchantId embedded).
        if (referrer.wallet) {
            return {
                type: "referral_link",
                v: 1,
                referrerWallet: referrer.wallet,
            };
        }

        if (input.utmSource || input.utmMedium || input.utmCampaign) {
            return {
                type: "paid_ad",
                utmSource: input.utmSource,
                utmMedium: input.utmMedium,
                utmCampaign: input.utmCampaign,
                utmTerm: input.utmTerm,
                utmContent: input.utmContent,
            };
        }

        return { type: "direct" };
    }

    /**
     * Wallet lookup takes precedence — it's global, WebAuthn-bound, and survives
     * localStorage clears. Anonymous fingerprint (clientId scoped to merchantId)
     * is the fallback for truly anonymous sharers.
     */
    private async resolveReferrerGroupId(
        referrer: NormalizedReferrer
    ): Promise<string | undefined> {
        const repo = IdentityContext.repositories.identity;

        if (referrer.wallet) {
            const group = await repo.findGroupByIdentity({
                type: "wallet",
                value: referrer.wallet,
            });
            if (group?.id) return group.id;
        }

        if (referrer.clientId && referrer.merchantId) {
            const group = await repo.findGroupByIdentity({
                type: "anonymous_fingerprint",
                value: referrer.clientId,
                merchantId: referrer.merchantId,
            });
            return group?.id ?? undefined;
        }

        return undefined;
    }
}
