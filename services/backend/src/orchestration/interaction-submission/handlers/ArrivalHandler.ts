import type { Address } from "viem";
import { isAddress } from "viem";
import type { ReferralService } from "../../../domain/attribution";
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
};

export type ArrivalExtra = {
    referralLinkId: string | null;
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
    constructor(private readonly referralService: ReferralService) {}

    getInteractionType(_input: ArrivalInput): InteractionType {
        return "referral";
    }

    buildExternalEventId(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload,
        _context: HandlerContext
    ): string {
        // Invariant: only reached when `shouldCreateInteractionLog` returned
        // true — i.e. `referralRegistered === true` — which the discriminated
        // union on `ReferralArrivalPayload` ties to a non-null `referralLinkId`.
        if (!payload.referralLinkId) {
            throw new Error(
                "Invariant violated: buildExternalEventId called without referralLinkId"
            );
        }
        return `referral:${payload.referralLinkId}`;
    }

    async buildPayload(
        input: ArrivalInput,
        context: HandlerContext
    ): Promise<ReferralArrivalPayload> {
        const referrer = normalizeReferrer(input);
        const referrerIdentityGroupId =
            await this.resolveReferrerGroupId(referrer);

        const base = {
            referrerWallet: referrer.wallet,
            referrerClientId: referrer.clientId,
            referrerMerchantId: referrer.merchantId,
            referralTimestamp: referrer.timestamp,
        };

        if (referrerIdentityGroupId) {
            const result = await this.referralService.registerReferral({
                merchantId: input.merchantId,
                referrerIdentityGroupId,
                refereeIdentityGroupId: context.identity.identityGroupId,
                sourceData:
                    referrer.timestamp !== undefined
                        ? { type: "link", sharedAt: referrer.timestamp }
                        : { type: "link" },
            });
            if (result.registered) {
                return {
                    ...base,
                    referralRegistered: true,
                    referralLinkId: result.link.id,
                };
            }
        }

        return {
            ...base,
            referralRegistered: false,
            referralLinkId: null,
        };
    }

    async postProcess(
        _input: ArrivalInput,
        _context: HandlerContext,
        payload: ReferralArrivalPayload
    ): Promise<ArrivalExtra> {
        return {
            referralLinkId: payload.referralLinkId,
        };
    }

    /**
     * Only persist an interaction log when a *new* referral edge was created.
     * Subsequent clicks from the same referrer-referee pair, organic visits,
     * and self-referrals all return `referralRegistered=false` and are
     * intentionally not logged — the dashboard's "first interaction" query
     * leans on this row, so it must mark the genuine starting point of the
     * relationship.
     */
    shouldCreateInteractionLog(
        _input: ArrivalInput,
        payload: ReferralArrivalPayload
    ): boolean {
        return payload.referralRegistered === true;
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
