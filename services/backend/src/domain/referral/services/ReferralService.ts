import { log } from "@backend-infrastructure";
import { ReferralLinkRepository } from "../repositories/ReferralLinkRepository";

type ReferralChainMember = {
    identityGroupId: string;
    depth: number;
};

const DEFAULT_MAX_CHAIN_DEPTH = 5;

export class ReferralService {
    private readonly repository: ReferralLinkRepository;

    constructor(repository?: ReferralLinkRepository) {
        this.repository = repository ?? new ReferralLinkRepository();
    }

    async registerReferral(params: {
        merchantId: string;
        referrerIdentityGroupId: string;
        refereeIdentityGroupId: string;
    }): Promise<{ registered: boolean; existingReferrer?: string }> {
        if (params.referrerIdentityGroupId === params.refereeIdentityGroupId) {
            log.debug(
                { merchantId: params.merchantId },
                "Self-referral attempted, skipping"
            );
            return { registered: false };
        }

        const existing = await this.repository.findByReferee(
            params.merchantId,
            params.refereeIdentityGroupId
        );

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

        const created = await this.repository.create({
            merchantId: params.merchantId,
            referrerIdentityGroupId: params.referrerIdentityGroupId,
            refereeIdentityGroupId: params.refereeIdentityGroupId,
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

        return { registered: true };
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

    async getDirectReferrer(params: {
        merchantId: string;
        identityGroupId: string;
    }): Promise<string | null> {
        const link = await this.repository.findByReferee(
            params.merchantId,
            params.identityGroupId
        );
        return link?.referrerIdentityGroupId ?? null;
    }

    async getReferees(params: {
        merchantId: string;
        referrerIdentityGroupId: string;
    }): Promise<string[]> {
        const links = await this.repository.findByReferrer(
            params.merchantId,
            params.referrerIdentityGroupId
        );
        return links.map((l) => l.refereeIdentityGroupId);
    }
}
