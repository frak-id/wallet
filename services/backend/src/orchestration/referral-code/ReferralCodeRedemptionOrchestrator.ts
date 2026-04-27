import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";

export class ReferralCodeRedemptionOrchestrator {
    constructor(
        private readonly referralCodeService: ReferralCodeService,
        private readonly referralLinkRepository: ReferralLinkRepository
    ) {}

    /**
     * Redeem someone else's referral code, creating a cross-merchant
     * `referral_links` row that feeds the reward pipeline as the referrer of
     * last resort.
     *
     * Throws {@link HttpError} on:
     *  - 404 `NOT_FOUND` — code does not exist or has been revoked.
     *  - 400 `SELF_REFERRAL` — owner of the code is the caller.
     *  - 409 `WOULD_CYCLE` — inserting the edge would close a cycle anywhere
     *    in the referral graph (scope-agnostic check).
     *  - 409 `ALREADY_REDEEMED` — caller already has a cross-merchant
     *    referrer (first redemption wins, no switching).
     *
     * Revoked codes are not redeemable. Existing `referral_links` rows that
     * point to a now-revoked code via `referral_code_id` are preserved —
     * revocation only blocks future redemptions.
     */
    async redeem(params: {
        code: string;
        refereeIdentityGroupId: string;
    }): Promise<{ referrerIdentityGroupId: string }> {
        const { code, refereeIdentityGroupId } = params;

        const referralCode = await this.referralCodeService.findByCode(code);
        if (!referralCode) {
            throw HttpError.notFound("NOT_FOUND", "Referral code not found");
        }

        if (referralCode.ownerIdentityGroupId === refereeIdentityGroupId) {
            throw HttpError.badRequest(
                "SELF_REFERRAL",
                "Cannot redeem your own referral code"
            );
        }

        const wouldCycle = await this.referralLinkRepository.wouldCreateCycle(
            referralCode.ownerIdentityGroupId,
            refereeIdentityGroupId
        );
        if (wouldCycle) {
            throw HttpError.conflict(
                "WOULD_CYCLE",
                "Redemption would create a referral cycle"
            );
        }

        const created = await this.referralLinkRepository.create({
            scope: "cross_merchant",
            merchantId: null,
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            refereeIdentityGroupId,
            source: "code",
            sourceData: { type: "code", codeId: referralCode.id },
        });

        if (!created) {
            // Partial-unique race winner got there first — surface as
            // already-redeemed rather than a generic error.
            throw HttpError.conflict(
                "ALREADY_REDEEMED",
                "A cross-merchant referrer is already registered"
            );
        }

        log.info(
            {
                referralCodeId: referralCode.id,
                ownerIdentityGroupId: referralCode.ownerIdentityGroupId,
                refereeIdentityGroupId,
            },
            "Referral code redeemed"
        );

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
        };
    }
}
