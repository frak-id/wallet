import { businessMetrics, eventEmitter, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import {
    type CampaignRuleRepository,
    hasRemainingBudget,
} from "../../domain/campaign/repositories/CampaignRuleRepository";
import type { DropSelect } from "../../domain/game/db/schema";
import type { DropRepository } from "../../domain/game/repositories/DropRepository";
import type { DropSummary } from "../../domain/game/schemas";
import { dropJoinExternalEventId, isDropOpen } from "../../domain/game/utils";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { FRAK_CODE_ONBOARDING_WINDOW_MS } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type {
    RedeemContext,
    ReferralCodeKind,
} from "../../domain/referral-code/schemas";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import { interactionTypes } from "../../domain/rewards/schemas";
import type { FrakGameOrchestrator } from "../game";

type FrakCodeRejection = Parameters<typeof businessMetrics.frakCodeRejected>[0];

type RedeemParams = {
    code: string;
    refereeIdentityGroupId: string;
    context?: RedeemContext;
};

export type RedeemResult = {
    referrerIdentityGroupId: string;
    kind: ReferralCodeKind;
    drop?: DropSummary;
};

export class ReferralCodeRedemptionOrchestrator {
    constructor(
        private readonly referralCodeService: ReferralCodeService,
        private readonly referralLinkRepository: ReferralLinkRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly dropRepository: DropRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository,
        private readonly frakGame: FrakGameOrchestrator
    ) {}

    /**
     * Redeem a referral code: a friend's or Frak code sets the caller's single
     * cross-merchant referrer, a drop code joins its drop. Errors are
     * `HttpError`s: 404 `NOT_FOUND`, 400 `SELF_REFERRAL`, 409 `WOULD_CYCLE`,
     * `ALREADY_REDEEMED`, `DROP_CLOSED`, `DROP_FULL`, `ALREADY_JOINED`.
     */
    async redeem(params: RedeemParams): Promise<RedeemResult> {
        const referralCode = await this.referralCodeService.findByCode(
            params.code
        );
        if (!referralCode) {
            throw codeNotFound();
        }

        if (referralCode.kind === "frak") {
            const drop = await this.dropRepository.findByReferralCodeId(
                referralCode.id
            );
            if (drop) {
                return this.joinDrop(drop, referralCode, params);
            }
            await this.assertFrakCodeRedeemable(
                referralCode,
                params.refereeIdentityGroupId,
                params.context
            );
        }

        await this.linkReferrer(referralCode, params.refereeIdentityGroupId);

        if (referralCode.kind === "user") {
            await this.emitReferralSignup(referralCode, params);
        }

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
        };
    }

    private async linkReferrer(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ): Promise<void> {
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

        const created = await this.createCrossMerchantLink(
            referralCode,
            refereeIdentityGroupId
        );
        if (!created) {
            // Partial-unique race winner got there first.
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
    }

    private createCrossMerchantLink(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ) {
        return this.referralLinkRepository.create({
            scope: "cross_merchant",
            merchantId: null,
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            refereeIdentityGroupId,
            source: "code",
            sourceData: { type: "code", codeId: referralCode.id },
        });
    }

    /** Pays both sides once the rule is live; one per referee, ever. */
    private async emitReferralSignup(
        referralCode: ReferralCodeSelect,
        { refereeIdentityGroupId, context }: RedeemParams
    ): Promise<void> {
        if (context !== "onboarding") return;
        if (!(await this.isNewAccount(refereeIdentityGroupId))) return;

        const created = await this.interactionLogRepository.createIdempotent({
            type: interactionTypes.referralSignup,
            identityGroupId: refereeIdentityGroupId,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: `signup:${refereeIdentityGroupId}`,
            payload: {
                referralCodeId: referralCode.id,
                referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            },
        });
        if (created) eventEmitter.emit("newInteraction");
    }

    /**
     * Joining never takes the referrer slot, so existing users and users with
     * a friend as referrer can join every drop. A brand-new account still gets
     * Frak as referrer, like a plain Frak code.
     */
    private async joinDrop(
        drop: DropSelect,
        referralCode: ReferralCodeSelect,
        { refereeIdentityGroupId, context }: RedeemParams
    ): Promise<RedeemResult> {
        const rule = await this.findJoinableRule(drop);

        const joined = await this.interactionLogRepository.createIdempotent({
            type: interactionTypes.dropJoin,
            identityGroupId: refereeIdentityGroupId,
            merchantId: FRAK_MERCHANT_ID,
            externalEventId: dropJoinExternalEventId(
                drop.id,
                refereeIdentityGroupId
            ),
            payload: { dropId: drop.id, campaignRuleId: rule.id },
        });
        if (!joined) {
            throw HttpError.conflict(
                "ALREADY_JOINED",
                "Already joined this drop"
            );
        }
        eventEmitter.emit("newInteraction");

        const rejection = await this.frakGateRejection(
            refereeIdentityGroupId,
            context
        );
        if (!rejection) {
            // Null when the slot is taken: the user keeps their referrer.
            await this.createCrossMerchantLink(
                referralCode,
                refereeIdentityGroupId
            );
        }

        log.info(
            { dropId: drop.id, refereeIdentityGroupId, linkedFrak: !rejection },
            "Drop joined"
        );

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
            drop: await this.frakGame.summarize(drop),
        };
    }

    /** The budget check is best effort: the cap itself is `consumeBudget`. */
    private async findJoinableRule(
        drop: DropSelect
    ): Promise<CampaignRuleSelect> {
        const rule = isDropOpen(drop, new Date())
            ? await this.campaignRuleRepository.findById(drop.campaignRuleId)
            : null;
        if (rule?.status !== "active") {
            throw HttpError.conflict("DROP_CLOSED", "This drop is closed");
        }
        if (!hasRemainingBudget(rule)) {
            throw HttpError.conflict("DROP_FULL", "This drop is full");
        }
        return rule;
    }

    private async isNewAccount(identityGroupId: string): Promise<boolean> {
        const group =
            await this.identityRepository.findGroupById(identityGroupId);
        if (!group?.createdAt) return false;
        return (
            Date.now() - group.createdAt.getTime() <=
            FRAK_CODE_ONBOARDING_WINDOW_MS
        );
    }

    private async frakGateRejection(
        refereeIdentityGroupId: string,
        context: RedeemContext | undefined
    ): Promise<FrakCodeRejection | null> {
        if (context !== "onboarding") return "no_onboarding_context";
        const [isNew, hasPurchase] = await Promise.all([
            this.isNewAccount(refereeIdentityGroupId),
            this.interactionLogRepository.hasPurchaseForGroup(
                refereeIdentityGroupId
            ),
        ]);
        if (!isNew) return "outside_onboarding_window";
        return hasPurchase ? "has_purchase" : null;
    }

    private async assertFrakCodeRedeemable(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string,
        context: RedeemContext | undefined
    ): Promise<void> {
        const reason = await this.frakGateRejection(
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
}

function codeNotFound(): HttpError {
    return HttpError.notFound("NOT_FOUND", "Referral code not found");
}
