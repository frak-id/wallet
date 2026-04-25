import { log } from "@backend-infrastructure";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";

export type RedemptionResult =
    | { success: true; referrerIdentityGroupId: string }
    | {
          success: false;
          error: string;
          code:
              | "NOT_FOUND"
              | "SELF_REFERRAL"
              | "ALREADY_REDEEMED"
              | "WOULD_CYCLE";
      };

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
     * Rules:
     *  - `NOT_FOUND` — the code does not exist, or has been revoked.
     *  - `SELF_REFERRAL` — the owner of the code is the caller.
     *  - `ALREADY_REDEEMED` — the caller already has a cross-merchant
     *    referrer (first redemption wins, no switching).
     *  - `WOULD_CYCLE` — inserting the edge would close a cycle anywhere in
     *    the referral graph (scope-agnostic check).
     *
     * Revoked codes are not redeemable. Existing `referral_links` rows that
     * point to a now-revoked code via `referral_code_id` are preserved —
     * revocation only blocks future redemptions.
     */
    async redeem(params: {
        code: string;
        refereeIdentityGroupId: string;
    }): Promise<RedemptionResult> {
        const { code, refereeIdentityGroupId } = params;

        const referralCode = await this.referralCodeService.findByCode(code);
        if (!referralCode) {
            return {
                success: false,
                error: "Referral code not found",
                code: "NOT_FOUND",
            };
        }

        if (referralCode.ownerIdentityGroupId === refereeIdentityGroupId) {
            return {
                success: false,
                error: "Cannot redeem your own referral code",
                code: "SELF_REFERRAL",
            };
        }

        const wouldCycle = await this.referralLinkRepository.wouldCreateCycle(
            referralCode.ownerIdentityGroupId,
            refereeIdentityGroupId
        );
        if (wouldCycle) {
            return {
                success: false,
                error: "Redemption would create a referral cycle",
                code: "WOULD_CYCLE",
            };
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
            // The partial-unique race winner got there first — treat as
            // already-redeemed rather than an error.
            return {
                success: false,
                error: "A cross-merchant referrer is already registered",
                code: "ALREADY_REDEEMED",
            };
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
            success: true,
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
        };
    }
}
