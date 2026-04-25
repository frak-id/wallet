import { log } from "@backend-infrastructure";
import type { ReferralLinkSelect } from "../db/schema";
import type { ReferralLinkRepository } from "../repositories/ReferralLinkRepository";
import type { ReferralLinkSourceData } from "../schemas";

type ReferralChainMember = {
    identityGroupId: string;
    depth: number;
};

const DEFAULT_MAX_CHAIN_DEPTH = 5;

export type RegisterReferralResult =
    | { registered: true; link: ReferralLinkSelect }
    | { registered: false; existingReferrer?: string };

export class ReferralService {
    constructor(private readonly repository: ReferralLinkRepository) {}

    async registerReferral(params: {
        merchantId: string;
        referrerIdentityGroupId: string;
        refereeIdentityGroupId: string;
        sourceData?: ReferralLinkSourceData;
    }): Promise<RegisterReferralResult> {
        if (params.referrerIdentityGroupId === params.refereeIdentityGroupId) {
            log.debug(
                { merchantId: params.merchantId },
                "Self-referral attempted, skipping"
            );
            return { registered: false };
        }

        const existing = await this.repository.findByReferee({
            merchantId: params.merchantId,
            refereeIdentityGroupId: params.refereeIdentityGroupId,
            scope: "merchant",
        });

        if (existing) {
            log.debug(
                {
                    merchantId: params.merchantId,
                    refereeId: params.refereeIdentityGroupId,
                    existingReferrerId: existing.referrerIdentityGroupId,
                },
                "Referral already exists, first referrer wins"
            );
            return {
                registered: false,
                existingReferrer: existing.referrerIdentityGroupId,
            };
        }

        // Check if this would create a referral chain cycle
        // No depth ceiling — CTE explores the full chain with path-based
        // cycle detection to guarantee termination
        const wouldCycle = await this.repository.wouldCreateCycle(
            params.referrerIdentityGroupId,
            params.refereeIdentityGroupId
        );
        if (wouldCycle) {
            log.debug(
                {
                    merchantId: params.merchantId,
                    referrerId: params.referrerIdentityGroupId,
                    refereeId: params.refereeIdentityGroupId,
                },
                "Referral would create cycle, skipping"
            );
            return { registered: false };
        }

        const created = await this.repository.create({
            scope: "merchant",
            merchantId: params.merchantId,
            referrerIdentityGroupId: params.referrerIdentityGroupId,
            refereeIdentityGroupId: params.refereeIdentityGroupId,
            source: "link",
            sourceData: params.sourceData,
        });

        if (!created) {
            return { registered: false };
        }

        log.debug(
            {
                merchantId: params.merchantId,
                referrerId: params.referrerIdentityGroupId,
                refereeId: params.refereeIdentityGroupId,
            },
            "Referral link registered"
        );

        return { registered: true, link: created };
    }

    async getReferralChain(params: {
        merchantId: string;
        identityGroupId: string;
        maxDepth?: number;
    }): Promise<ReferralChainMember[]> {
        return this.repository.findChain(
            params.merchantId,
            params.identityGroupId,
            params.maxDepth ?? DEFAULT_MAX_CHAIN_DEPTH
        );
    }
}
