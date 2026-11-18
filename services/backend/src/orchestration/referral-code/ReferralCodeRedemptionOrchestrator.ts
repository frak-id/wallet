import { businessMetrics, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { GameSelect } from "../../domain/game/db/schema";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type { GameSummary } from "../../domain/game/schemas";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import {
    FRAK_CODE_ONBOARDING_WINDOW_MS,
    FRAK_REFERRAL_IDENTITY_GROUP_ID,
} from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type {
    RedeemContext,
    ReferralCodeKind,
} from "../../domain/referral-code/schemas";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import type { FrakGameOrchestrator } from "../game";

type FrakCodeRejection = Parameters<typeof businessMetrics.frakCodeRejected>[0];

/** Why a code left the referrer slot as it was. */
type LinkRefusal = "WOULD_CYCLE" | "ALREADY_REDEEMED";

type RedeemParams = {
    code: string;
    refereeIdentityGroupId: string;
    context?: RedeemContext;
    /** Frak holds the slot: `true` replaces it (no welcome bonus), `false` keeps it, unset asks. */
    replaceFrakReferrer?: boolean;
};

export type RedeemResult = {
    referrerIdentityGroupId: string;
    kind: ReferralCodeKind;
    /** The game joined: its own code, or the current open game on a friend's code. */
    game?: GameSummary;
    /** Join reward: only a new user who entered the game code at signup, once. */
    gameReward?: number;
    /** The caller's signup reward, set when a friend's signup was recorded. */
    signupReward?: number;
};

export class ReferralCodeRedemptionOrchestrator {
    constructor(
        private readonly referralCodeService: ReferralCodeService,
        private readonly referralLinkRepository: ReferralLinkRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly gameRepository: GameRepository,
        private readonly frakGame: FrakGameOrchestrator
    ) {}

    /**
     * Redeem a referral code: a friend's or Frak code sets the caller's single
     * cross-merchant referrer, a game code joins its game. A friend's code also
     * joins the current open game. Errors are `HttpError`s: 404 `NOT_FOUND`,
     * 400 `SELF_REFERRAL`, 409 `WOULD_CYCLE`, `ALREADY_REDEEMED`,
     * `GAME_CLOSED`, `FRAK_REFERRER`.
     */
    async redeem(params: RedeemParams): Promise<RedeemResult> {
        const referralCode = await this.referralCodeService.findByCode(
            params.code
        );
        if (!referralCode) {
            throw codeNotFound();
        }
        if (referralCode.kind === "user") {
            return this.redeemFriendCode(referralCode, params);
        }

        const game = await this.gameRepository.findByReferralCodeId(
            referralCode.id
        );
        if (game) {
            return this.joinGame(game, referralCode, params);
        }
        await this.assertFrakCodeRedeemable(
            referralCode,
            params.refereeIdentityGroupId,
            params.context
        );
        const refusal = await this.linkReferrer(referralCode, params);
        if (refusal) throw linkRefusalError(refusal);

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
        };
    }

    /** With a game open, a referrer already in place is kept and the user joins all the same. */
    private async redeemFriendCode(
        referralCode: ReferralCodeSelect,
        params: RedeemParams
    ): Promise<RedeemResult> {
        const referee = params.refereeIdentityGroupId;
        // Read before linking: once linked, a retry fails as ALREADY_REDEEMED.
        const signupPlan = (await this.paysSignup(params))
            ? await this.frakGame.planSignup()
            : null;
        const game = signupPlan
            ? (signupPlan.game?.game ?? null)
            : await this.gameRepository.findCurrent(new Date());

        const refusal = await this.linkReferrer(referralCode, params);
        if (refusal && !game) throw linkRefusalError(refusal);

        const base = {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
        };
        if (signupPlan && !refusal) {
            const signup = await this.frakGame.applySignup(
                signupPlan,
                referralCode,
                referee
            );
            return { ...base, game: signup.game, signupReward: signup.reward };
        }
        return {
            ...base,
            game: game
                ? await this.frakGame.joinWithFriendCode(game, referee)
                : undefined,
        };
    }

    private async paysSignup({
        refereeIdentityGroupId,
        context,
    }: RedeemParams): Promise<boolean> {
        if (context !== "onboarding") return false;
        return this.isNewAccount(refereeIdentityGroupId);
    }

    /** `null` once linked; a refusal leaves the current referrer in place. */
    private async linkReferrer(
        referralCode: ReferralCodeSelect,
        { refereeIdentityGroupId, replaceFrakReferrer }: RedeemParams
    ): Promise<LinkRefusal | null> {
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
        if (wouldCycle) return "WOULD_CYCLE";

        if (await this.frakHoldsSlot(referralCode, refereeIdentityGroupId)) {
            if (replaceFrakReferrer === undefined) {
                throw HttpError.conflict(
                    "FRAK_REFERRER",
                    "Replacing Frak as referrer ends the welcome bonus"
                );
            }
            if (!replaceFrakReferrer) return "ALREADY_REDEEMED";
            await this.referralLinkRepository.removeReferrer({
                merchantId: null,
                refereeIdentityGroupId,
                scope: "cross_merchant",
                reason: "removed",
            });
            log.info({ refereeIdentityGroupId }, "Frak referrer replaced");
        }

        const created = await this.createCrossMerchantLink(
            referralCode,
            refereeIdentityGroupId
        );
        // Partial-unique: someone already holds the slot.
        if (!created) return "ALREADY_REDEEMED";

        log.info(
            {
                referralCodeId: referralCode.id,
                ownerIdentityGroupId: referralCode.ownerIdentityGroupId,
                refereeIdentityGroupId,
                kind: referralCode.kind,
            },
            "Referral code redeemed"
        );
        return null;
    }

    private async frakHoldsSlot(
        referralCode: ReferralCodeSelect,
        refereeIdentityGroupId: string
    ): Promise<boolean> {
        if (
            referralCode.ownerIdentityGroupId ===
            FRAK_REFERRAL_IDENTITY_GROUP_ID
        ) {
            return false;
        }
        const current = await this.referralLinkRepository.findByReferee({
            merchantId: null,
            refereeIdentityGroupId,
            scope: "cross_merchant",
        });
        return (
            current?.referrerIdentityGroupId === FRAK_REFERRAL_IDENTITY_GROUP_ID
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

    /**
     * Joining never takes the referrer slot, so existing users and users with
     * a friend as referrer can join the game, but only a new account from
     * onboarding earns the join reward and gets Frak as referrer.
     */
    private async joinGame(
        game: GameSelect,
        referralCode: ReferralCodeSelect,
        { refereeIdentityGroupId, context }: RedeemParams
    ): Promise<RedeemResult> {
        const rejection = await this.frakGateRejection(
            refereeIdentityGroupId,
            context
        );
        const joined = await this.frakGame.joinGame(
            game,
            refereeIdentityGroupId,
            !rejection
        );
        if (!rejection) {
            // Null when the slot is taken: the user keeps their referrer.
            await this.createCrossMerchantLink(
                referralCode,
                refereeIdentityGroupId
            );
        }

        log.info(
            { gameId: game.id, refereeIdentityGroupId, linkedFrak: !rejection },
            "Game joined"
        );

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
            ...joined,
        };
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

function linkRefusalError(refusal: LinkRefusal): HttpError {
    return refusal === "WOULD_CYCLE"
        ? HttpError.conflict(
              "WOULD_CYCLE",
              "Redemption would create a referral cycle"
          )
        : HttpError.conflict(
              "ALREADY_REDEEMED",
              "A cross-merchant referrer is already registered"
          );
}
