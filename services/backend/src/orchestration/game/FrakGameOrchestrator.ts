import {
    eventEmitter,
    type ProductEventMap,
    productEvents,
} from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import {
    type CampaignRuleRepository,
    hasRemainingBudget,
} from "../../domain/campaign/repositories/CampaignRuleRepository";
import type { GameSelect } from "../../domain/game/db/schema";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type {
    CurrentGameResponse,
    GameSummary,
    InviteRewards,
} from "../../domain/game/schemas";
import { NO_TICKETS, totalTickets } from "../../domain/game/tickets";
import {
    gameJoinExternalEventId,
    isGameOpen,
    signupExternalEventId,
} from "../../domain/game/utils";
import type { InstagramLinkRepository } from "../../domain/instagram/repositories/InstagramLinkRepository";
import { isInstagramEligible } from "../../domain/instagram/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type { InteractionLogInsert } from "../../domain/rewards/db/schema";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import {
    interactionTypes,
    type RecipientType,
} from "../../domain/rewards/schemas";
import type { GamePlayerOrchestrator } from "./GamePlayerOrchestrator";
import { summarizeGame } from "./summarizeGame";

type FrakInteraction = Pick<
    InteractionLogInsert,
    "type" | "identityGroupId" | "payload"
> & { externalEventId: string };

/** `gameReward` is set only for a newcomer whose call created the join interaction. */
type JoinOutcome = { game: GameSummary; gameReward?: number };

/** Read before the referrer link is written, applied after it. */
export type SignupPlan = {
    reward?: number;
    game?: { game: GameSelect; summary: GameSummary };
};

export type SignupOutcome = { reward?: number; game?: GameSummary };

const NOT_PLAYING = {
    participating: false,
    tickets: 0,
    ticketsBySource: NO_TICKETS,
    eligible: false,
};

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
        private readonly gameRepository: GameRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly gamePlayerOrchestrator: GamePlayerOrchestrator,
        private readonly instagramLinkRepository: InstagramLinkRepository
    ) {}

    async getCurrentGame(
        identityGroupId: string
    ): Promise<CurrentGameResponse> {
        const game = await this.gameRepository.findCurrent(new Date());
        if (!game) return { game: null, me: NOT_PLAYING };

        const [summary, joinedAt, instagramLink] = await Promise.all([
            this.summarize(game),
            this.gamePlayerOrchestrator.joinedAt(game.id, identityGroupId),
            this.instagramLinkRepository.findByIdentityGroup(identityGroupId),
        ]);
        const ticketsBySource = joinedAt
            ? await this.gamePlayerOrchestrator.ticketsOf(
                  game,
                  identityGroupId,
                  joinedAt
              )
            : NO_TICKETS;
        return {
            game: summary,
            me: {
                participating: joinedAt !== null,
                tickets: totalTickets(ticketsBySource),
                ticketsBySource,
                eligible: isInstagramEligible(instagramLink),
            },
        };
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

    /** Only a `newcomer` earns the join reward; 409 `GAME_CLOSED` for a closed game never joined. */
    async joinGame(
        game: GameSelect,
        identityGroupId: string,
        newcomer: boolean
    ): Promise<JoinOutcome> {
        const joinedAt = await this.gamePlayerOrchestrator.joinedAt(
            game.id,
            identityGroupId
        );
        if (joinedAt) return { game: await this.summarize(game) };
        if (!isGameOpen(game, new Date())) {
            throw HttpError.conflict("GAME_CLOSED", "This game is closed");
        }
        const [summary, reward] = await Promise.all([
            this.summarize(game),
            newcomer ? this.joinReward(game) : undefined,
        ]);
        const created = await this.writeJoin(
            game,
            identityGroupId,
            newcomer,
            "game_code"
        );
        return { game: summary, gameReward: created ? reward : undefined };
    }

    /** The signup reward and the open game the referee joins with it. */
    async planSignup(): Promise<SignupPlan> {
        const [invite, game] = await Promise.all([
            this.inviteRewards(),
            this.gameRepository.findCurrent(new Date()),
        ]);
        if (!game) return { reward: invite?.referee };
        const summary = await this.summarize(game);
        return { reward: invite?.referee, game: { game, summary } };
    }

    /** Pays both sides once the signup rule is live; one per referee, ever. */
    async applySignup(
        plan: SignupPlan,
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ): Promise<SignupOutcome> {
        const signedUp = await this.logInteraction({
            type: interactionTypes.referralSignup,
            identityGroupId: refereeIdentityGroupId,
            externalEventId: signupExternalEventId(refereeIdentityGroupId),
            payload: {
                referralCodeId: referralCode.id,
                referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            },
        });
        if (signedUp) {
            productEvents.track(
                "referral_signup_completed",
                refereeIdentityGroupId,
                {
                    referrer_identity_group_id:
                        referralCode.ownerIdentityGroupId,
                }
            );
        }
        if (!plan.game) return { reward: plan.reward };

        await this.writeJoin(
            plan.game.game,
            refereeIdentityGroupId,
            false,
            "friend_signup"
        );
        return { reward: plan.reward, game: plan.game.summary };
    }

    /** The rule's referee payout, unless it is paused or out of budget; never blocks a join. */
    private async joinReward(game: GameSelect): Promise<number | undefined> {
        const rule = await this.campaignRuleRepository.findById(
            game.campaignRuleId
        );
        if (rule?.status !== "active" || !hasRemainingBudget(rule)) {
            return undefined;
        }
        return fixedPayout(rule, "referee") || undefined;
    }

    /** True when this call created the join interaction, which is what gets paid. */
    private async writeJoin(
        game: GameSelect,
        identityGroupId: string,
        newcomer: boolean,
        source: ProductEventMap["game_joined"]["source"]
    ): Promise<boolean> {
        const created = await this.logInteraction({
            type: interactionTypes.gameJoin,
            identityGroupId,
            externalEventId: gameJoinExternalEventId(game.id, identityGroupId),
            payload: { gameId: game.id, newcomer },
        });
        if (created) {
            productEvents.track("game_joined", identityGroupId, {
                game_id: game.id,
                source,
                newcomer,
            });
        }
        return created;
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

    private summarize(game: GameSelect): Promise<GameSummary> {
        return summarizeGame(game, this.merchantRepository);
    }
}
