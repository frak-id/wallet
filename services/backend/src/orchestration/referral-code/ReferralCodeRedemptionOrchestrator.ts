import { businessMetrics, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { GameSelect } from "../../domain/game/db/schema";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type { GameSummary } from "../../domain/game/schemas";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { FRAK_CODE_ONBOARDING_WINDOW_MS } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type {
    RedeemContext,
    ReferralCodeKind,
} from "../../domain/referral-code/schemas";
import type { ReferralCodeService } from "../../domain/referral-code/services/ReferralCodeService";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
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
    /** The game joined: its own code, or the current open game on a friend's signup. */
    game?: GameSummary;
    /** Reward queued by this join; absent on a re-join or an empty budget. */
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
     * cross-merchant referrer, a game code joins its game. A friend's signup
     * also joins the current open game. Errors are `HttpError`s: 404
     * `NOT_FOUND`, 400 `SELF_REFERRAL`, 409 `WOULD_CYCLE`, `ALREADY_REDEEMED`,
     * `GAME_CLOSED`.
     */
    async redeem(params: RedeemParams): Promise<RedeemResult> {
        const referralCode = await this.referralCodeService.findByCode(
            params.code
        );
        if (!referralCode) {
            throw codeNotFound();
        }

        if (referralCode.kind === "frak") {
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
        }

        // Read before linking: once linked, a retry fails as ALREADY_REDEEMED.
        const signupPlan = (await this.paysSignup(referralCode, params))
            ? await this.frakGame.planSignup()
            : null;

        await this.linkReferrer(referralCode, params.refereeIdentityGroupId);

        const signup =
            signupPlan &&
            (await this.frakGame.applySignup(
                signupPlan,
                referralCode,
                params.refereeIdentityGroupId
            ));

        return {
            referrerIdentityGroupId: referralCode.ownerIdentityGroupId,
            kind: referralCode.kind,
            game: signup?.game,
            gameReward: signup?.gameReward,
            signupReward: signup?.reward,
        };
    }

    private async paysSignup(
        referralCode: ReferralCodeSelect,
        { refereeIdentityGroupId, context }: RedeemParams
    ): Promise<boolean> {
        if (referralCode.kind !== "user" || context !== "onboarding") {
            return false;
        }
        return this.isNewAccount(refereeIdentityGroupId);
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

    /**
     * Joining never takes the referrer slot, so existing users and users with
     * a friend as referrer can join the game. A brand-new account still gets
     * Frak as referrer, like a plain Frak code.
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
            refereeIdentityGroupId
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
