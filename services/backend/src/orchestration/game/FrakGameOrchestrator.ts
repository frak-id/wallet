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
    InviteRewards,
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
import {
    interactionTypes,
    type RecipientType,
} from "../../domain/rewards/schemas";

type FrakInteraction = Pick<
    InteractionLogInsert,
    "type" | "identityGroupId" | "payload"
> & { externalEventId: string };

type JoinRejection = "DROP_CLOSED" | "DROP_FULL";

const rejectionMessages: Record<JoinRejection, string> = {
    DROP_CLOSED: "This drop is closed",
    DROP_FULL: "This drop is full",
};

type JoinPlan = { drop: DropSelect; summary: DropSummary };

/** Read before the referrer link is written, applied after it. */
export type SignupPlan = { reward?: number; drops: JoinPlan[] };

export type SignupOutcome = { reward?: number; drop?: DropSummary };

/** Sum of a rule's fixed rewards for `recipient`, in the rule's token. */
function fixedPayout(rule: CampaignRuleSelect, recipient: RecipientType) {
    return rule.rule.rewards.reduce(
        (sum, reward) =>
            reward.recipient === recipient && reward.amountType === "fixed"
                ? sum + reward.amount
                : sum,
        0
    );
}

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

        const [rule, joined] = await Promise.all([
            this.campaignRuleRepository.findById(drop.campaignRuleId),
            this.hasJoined(drop.id, identityGroupId),
        ]);
        const summary = await this.summarize(drop, rule);
        return { drop: { ...summary, joined } };
    }

    /** Per-friend amounts of the live signup rule, null when none is live. */
    async inviteRewards(): Promise<InviteRewards | null> {
        const [rule] = await this.campaignRuleRepository.findActiveByMerchant(
            FRAK_MERCHANT_ID,
            interactionTypes.referralSignup
        );
        if (!rule) return null;
        return {
            referrer: fixedPayout(rule, "referrer"),
            referee: fixedPayout(rule, "referee"),
        };
    }

    /** 409 `DROP_CLOSED`, `DROP_FULL` or `ALREADY_JOINED`; reads run before the join is written. */
    async joinDrop(
        drop: DropSelect,
        identityGroupId: string
    ): Promise<DropSummary> {
        const plan = await this.planJoin(drop);
        if ("rejection" in plan) {
            throw HttpError.conflict(
                plan.rejection,
                rejectionMessages[plan.rejection]
            );
        }
        if (!(await this.writeJoin(drop, identityGroupId))) {
            throw HttpError.conflict(
                "ALREADY_JOINED",
                "Already joined this drop"
            );
        }
        return plan.summary;
    }

    /** The signup reward and the referrer's open drops the referee joins with it. */
    async planSignup(referrerIdentityGroupId: string): Promise<SignupPlan> {
        const [invite, open] = await Promise.all([
            this.inviteRewards(),
            this.dropRepository.findOpen(new Date()),
        ]);
        const plans = await Promise.all(
            open.map(async (drop) => {
                const [joined, plan] = await Promise.all([
                    this.hasJoined(drop.id, referrerIdentityGroupId),
                    this.planJoin(drop),
                ]);
                return joined && "summary" in plan ? plan : null;
            })
        );
        return {
            reward: invite?.referee,
            drops: plans.filter((plan) => plan !== null),
        };
    }

    /** Pays both sides once the signup rule is live; one per referee, ever. */
    async applySignup(
        plan: SignupPlan,
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ): Promise<SignupOutcome> {
        await this.logInteraction({
            type: interactionTypes.referralSignup,
            identityGroupId: refereeIdentityGroupId,
            externalEventId: signupExternalEventId(refereeIdentityGroupId),
            payload: {
                referralCodeId: referralCode.id,
                referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            },
        });
        let drop: DropSummary | undefined;
        for (const join of plan.drops) {
            if (await this.writeJoin(join.drop, refereeIdentityGroupId)) {
                drop ??= join.summary;
            }
        }
        return { reward: plan.reward, drop };
    }

    private hasJoined(dropId: string, identityGroupId: string) {
        return this.interactionLogRepository.existsByExternalEvent({
            merchantId: FRAK_MERCHANT_ID,
            type: interactionTypes.dropJoin,
            externalEventId: dropJoinExternalEventId(dropId, identityGroupId),
        });
    }

    /** The budget check is best effort: the cap itself is `consumeBudget`. */
    private async planJoin(
        drop: DropSelect
    ): Promise<JoinPlan | { rejection: JoinRejection }> {
        const rule = isDropOpen(drop, new Date())
            ? await this.campaignRuleRepository.findById(drop.campaignRuleId)
            : null;
        if (rule?.status !== "active") {
            return { rejection: "DROP_CLOSED" };
        }
        if (!hasRemainingBudget(rule)) return { rejection: "DROP_FULL" };
        return { drop, summary: await this.summarize(drop, rule) };
    }

    /** False when the user already joined this drop. */
    private writeJoin(
        drop: DropSelect,
        identityGroupId: string
    ): Promise<boolean> {
        return this.logInteraction({
            type: interactionTypes.dropJoin,
            identityGroupId,
            externalEventId: dropJoinExternalEventId(drop.id, identityGroupId),
            payload: { dropId: drop.id },
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

    private async summarize(
        drop: DropSelect,
        rule: CampaignRuleSelect | null
    ): Promise<DropSummary> {
        const sponsor = drop.sponsorMerchantId
            ? await this.merchantRepository.findById(drop.sponsorMerchantId)
            : null;
        return {
            id: drop.id,
            prizeDescription: drop.prizeDescription,
            reward: rule ? fixedPayout(rule, "referee") : 0,
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
