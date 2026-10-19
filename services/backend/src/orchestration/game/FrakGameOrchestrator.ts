import { eventEmitter } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import {
    type CampaignRuleRepository,
    hasRemainingBudget,
} from "../../domain/campaign/repositories/CampaignRuleRepository";
import type { DropSelect } from "../../domain/game/db/schema";
import type { DropRepository } from "../../domain/game/repositories/DropRepository";
import type {
    CurrentDropResponse,
    DropSummary,
} from "../../domain/game/schemas";
import {
    dropJoinExternalEventId,
    isDropOpen,
    signupExternalEventId,
} from "../../domain/game/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type { InteractionLogInsert } from "../../domain/rewards/db/schema";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import { interactionTypes } from "../../domain/rewards/schemas";

type FrakInteraction = Pick<
    InteractionLogInsert,
    "type" | "identityGroupId" | "payload"
> & { externalEventId: string };

export class FrakGameOrchestrator {
    constructor(
        private readonly dropRepository: DropRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async getCurrentDrop(
        identityGroupId: string
    ): Promise<CurrentDropResponse> {
        const drop = await this.dropRepository.findCurrent(new Date());
        if (!drop) return { drop: null };

        const [summary, joined] = await Promise.all([
            this.summarize(drop),
            this.interactionLogRepository.existsByExternalEvent({
                merchantId: FRAK_MERCHANT_ID,
                type: interactionTypes.dropJoin,
                externalEventId: dropJoinExternalEventId(
                    drop.id,
                    identityGroupId
                ),
            }),
        ]);
        return { drop: { ...summary, joined } };
    }

    /** 409 `DROP_CLOSED`, `DROP_FULL` or `ALREADY_JOINED`; reads run before the join is written. */
    async joinDrop(
        drop: DropSelect,
        identityGroupId: string
    ): Promise<DropSummary> {
        const [rule, summary] = await Promise.all([
            this.findJoinableRule(drop),
            this.summarize(drop),
        ]);
        const joined = await this.logInteraction({
            type: interactionTypes.dropJoin,
            identityGroupId,
            externalEventId: dropJoinExternalEventId(drop.id, identityGroupId),
            payload: { dropId: drop.id, campaignRuleId: rule.id },
        });
        if (!joined) {
            throw HttpError.conflict(
                "ALREADY_JOINED",
                "Already joined this drop"
            );
        }
        return summary;
    }

    /** Pays both sides once the signup rule is live; one per referee, ever. */
    async recordSignup(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ): Promise<void> {
        await this.logInteraction({
            type: interactionTypes.referralSignup,
            identityGroupId: refereeIdentityGroupId,
            externalEventId: signupExternalEventId(refereeIdentityGroupId),
            payload: {
                referralCodeId: referralCode.id,
                referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            },
        });
    }

    private async logInteraction(
        interaction: FrakInteraction
    ): Promise<boolean> {
        const created = await this.interactionLogRepository.createIdempotent({
            ...interaction,
            merchantId: FRAK_MERCHANT_ID,
        });
        if (created) eventEmitter.emit("newInteraction");
        return created !== null;
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

    private async summarize(drop: DropSelect): Promise<DropSummary> {
        const sponsor = drop.sponsorMerchantId
            ? await this.merchantRepository.findById(drop.sponsorMerchantId)
            : null;
        return {
            id: drop.id,
            prizeDescription: drop.prizeDescription,
            startsAt: drop.startsAt,
            endsAt: drop.endsAt,
            sponsor: sponsor && {
                id: sponsor.id,
                name: sponsor.name,
                domain: sponsor.domain,
                logoUrl: sponsor.explorerConfig?.logoUrl,
            },
        };
    }
}
