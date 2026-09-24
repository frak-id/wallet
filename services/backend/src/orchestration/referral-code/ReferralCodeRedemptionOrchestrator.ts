import { businessMetrics, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { FRAK_CODE_ONBOARDING_WINDOW_MS } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type {
    RedeemContext,
    ReferralCodeKind,
} from "../../domain/referral-code/schemas";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";

type FrakCodeRejection = Parameters<typeof businessMetrics.frakCodeRejected>[0];

export class ReferralCodeRedemptionOrchestrator {
    constructor(
        private readonly referralCodeService: ReferralCodeService,
        private readonly referralLinkRepository: ReferralLinkRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    /**
     * Redeem someone else's referral code, creating a cross-merchant
     * `referral_links` row that feeds the reward pipeline as the referrer of
     * last resort.
     *
     * Throws {@link HttpError} on:
     *  - 404 `NOT_FOUND` — code does not exist, has been revoked, or is a
     *    Frak code redeemed outside onboarding (never disclosed as such).
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
        context?: RedeemContext;
    }): Promise<{ referrerIdentityGroupId: string; kind: ReferralCodeKind }> {
        const { code, refereeIdentityGroupId, context } = params;

        const referralCode = await this.referralCodeService.findByCode(code);
        if (!referralCode) {
            throw codeNotFound();
        }

        if (referralCode.kind === "frak") {
            await this.assertFrakCodeRedeemable(
                referralCode,
                refereeIdentityGroupId,
                context
            );
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
                kind: referralCode.kind,
            },
            "Referral code redeemed"
        );

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
        };
    }

    private async assertFrakCodeRedeemable(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string,
        context: RedeemContext | undefined
    ): Promise<void> {
        const reason = await this.findFrakCodeRejection(
            refereeIdentityGroupId,
            context
        );
        if (!reason) return;

        businessMetrics.frakCodeRejected(reason);
        log.info(
            {
                code: referralCode.code,
                identityGroupId: refereeIdentityGroupId,
                reason,
            },
            "Frak referral code rejected"
        );
        throw codeNotFound();
    }

    private async findFrakCodeRejection(
        refereeIdentityGroupId: string,
        context: RedeemContext | undefined
    ): Promise<FrakCodeRejection | null> {
        if (context !== "onboarding") return "no_onboarding_context";

        const [group, hasPurchase] = await Promise.all([
            this.identityRepository.findGroupById(refereeIdentityGroupId),
            this.interactionLogRepository.hasPurchaseForGroup(
                refereeIdentityGroupId
            ),
        ]);
        const ageMs = group?.createdAt
            ? Date.now() - group.createdAt.getTime()
            : Number.POSITIVE_INFINITY;
        if (ageMs > FRAK_CODE_ONBOARDING_WINDOW_MS) {
            return "outside_onboarding_window";
        }
        if (hasPurchase) return "has_purchase";
        return null;
    }
}

function codeNotFound(): HttpError {
    return HttpError.notFound("NOT_FOUND", "Referral code not found");
}
