import { randomUUID } from "node:crypto";
import { HttpError, isUuid } from "@backend-utils";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { LRUCache } from "lru-cache";
import { type Address, isAddress } from "viem";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { CampaignRuleRepository } from "../../domain/campaign/repositories/CampaignRuleRepository";
import type {
    CampaignRuleDefinition,
    CampaignTrigger,
    RewardDefinition,
} from "../../domain/campaign/schemas";
import type { CampaignManagementService } from "../../domain/campaign/services/CampaignManagementService";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import { drandRoundTime, hasCandidateWindow } from "../../domain/game/draw";
import type { GameDrawRepository } from "../../domain/game/repositories/GameDrawRepository";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type { DrawEntry, GameStatus } from "../../domain/game/schemas";
import { type TicketBreakdown, totalTickets } from "../../domain/game/tickets";
import { type DrawCheck, verifyPublicDraw } from "../../domain/game/verify";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { InstagramLinkRepository } from "../../domain/instagram/repositories/InstagramLinkRepository";
import type { InstagramPendingLinkRepository } from "../../domain/instagram/repositories/InstagramPendingLinkRepository";
import { instagramLevelOf, isDrawEligible } from "../../domain/instagram/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type {
    MerchantRepository,
    MerchantSelect,
} from "../../domain/merchant/repositories/MerchantRepository";
import { FRAK_SHARED_CAMPAIGN_BANK } from "../../domain/merchant/services/MerchantRegistrationService";
import type { ReferralCodeRepository } from "../../domain/referral-code/repositories/ReferralCodeRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import { interactionTypes } from "../../domain/rewards/schemas";
import type { DnsCheckRepository } from "../../infrastructure/dns/DnsCheckRepository";
import type { GameDrawOrchestrator } from "../game/GameDrawOrchestrator";
import type { GamePlayerOrchestrator } from "../game/GamePlayerOrchestrator";
import type {
    CreateGameInput,
    FrakGameSetup,
    FrakRuleSummary,
    GameAdmin,
    GameDrawAdmin,
    GamePlayer,
    GamePlayers,
    PublishSignupRuleInput,
} from "../schemas/internalSchemas";
import { toPayoutState } from "./FrakBankAdminOrchestrator";

/** The game rule outlives the game so joins processed after the close still pay. */
const GAME_RULE_GRACE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_UNLOCK_DAYS = 30;
const BUDGET_LABEL = "total";
const COUNT_CONCURRENCY = 10;
/** Counting every player's tickets is a few queries each: one count serves every viewer for this long. */
const PLAYERS_TTL_MS = 30 * 1000;

export type FrakMerchantOwner = { wallet: Address } | { accountId: string };

/** A wallet address or a business account id; 400 `INVALID_OWNER` otherwise. */
export function parseFrakMerchantOwner(raw: string): FrakMerchantOwner {
    const owner = raw.trim();
    if (isAddress(owner)) return { wallet: owner };
    if (isUuid(owner)) return { accountId: owner };
    throw HttpError.badRequest(
        "INVALID_OWNER",
        "The owner is a wallet address or a business account id"
    );
}

type PlayerRow = Omit<GamePlayer, "wallet" | "joinedAt" | "instagram">;

type RuleParams = {
    name: string;
    trigger: CampaignTrigger;
    rewards: [RewardDefinition["recipient"], number][];
    conditions?: CampaignRuleDefinition["conditions"];
    maxRewardsPerUser?: number;
    expiresAt?: Date;
    budget: number;
    unlockDays?: number;
};

function ruleSummary(rule: CampaignRuleSelect): FrakRuleSummary {
    return {
        id: rule.id,
        name: rule.name,
        status: rule.status,
        rewards: rule.rule.rewards.flatMap((reward) =>
            reward.amountType === "fixed"
                ? [{ recipient: reward.recipient, amount: reward.amount }]
                : []
        ),
        budget: {
            total:
                rule.budgetConfig?.find((b) => b.label === BUDGET_LABEL)
                    ?.amount ?? null,
            used: rule.budgetUsed?.[BUDGET_LABEL]?.used ?? 0,
        },
        expiresAt: rule.expiresAt,
    };
}

/** A live row until `entry` is frozen; live eligibility is filled in later from Instagram. */
function playerRow(
    identityGroupId: string,
    tickets: TicketBreakdown,
    entry?: DrawEntry
): PlayerRow {
    return {
        identityGroupId,
        tickets,
        totalTickets: totalTickets(tickets),
        eligible: entry?.discarded === null,
        drawTickets: entry?.drawTickets ?? null,
        discarded: entry?.discarded ?? null,
        pid: entry?.pid ?? null,
    };
}

/** Everything the CLI and the dashboard's internal page do on the Frak Game, in one place. */
export class FrakGameAdminOrchestrator {
    private readonly playersCache = new LRUCache<string, GamePlayers>({
        max: 8,
        ttl: PLAYERS_TTL_MS,
        fetchMethod: async (gameId) => this.countPlayers(gameId),
    });

    constructor(
        private readonly games: GameRepository,
        private readonly draws: GameDrawRepository,
        private readonly referralCodes: ReferralCodeRepository,
        private readonly campaignRules: CampaignRuleRepository,
        private readonly campaignManagement: CampaignManagementService,
        private readonly merchants: MerchantRepository,
        private readonly dnsCheck: DnsCheckRepository,
        private readonly players: GamePlayerOrchestrator,
        private readonly gameDraw: GameDrawOrchestrator,
        private readonly identities: IdentityRepository,
        private readonly instagramLinks: InstagramLinkRepository,
        private readonly instagramPendingLinks: InstagramPendingLinkRepository,
        private readonly assetLogs: AssetLogRepository
    ) {}

    async setup(): Promise<FrakGameSetup> {
        const [merchant, rules] = await Promise.all([
            this.merchants.findById(FRAK_MERCHANT_ID),
            this.campaignRules.findByMerchantAndStatus(FRAK_MERCHANT_ID, [
                "active",
                "paused",
            ]),
        ]);
        return {
            merchant: merchant && {
                id: merchant.id,
                name: merchant.name,
                domain: merchant.domain,
                bankAddress: merchant.bankAddress,
            },
            signupRules: rules
                .filter(
                    (rule) =>
                        rule.rule.trigger === interactionTypes.referralSignup
                )
                .map(ruleSummary),
        };
    }

    /** Seeds the Frak merchant on the shared campaign bank; a no-op once it exists. */
    async seedMerchant(params: {
        domain: string;
        owner: FrakMerchantOwner;
    }): Promise<{ merchant: MerchantSelect; created: boolean }> {
        const existing = await this.merchants.findById(FRAK_MERCHANT_ID);
        if (existing) return { merchant: existing, created: false };
        const merchant = await this.merchants.create({
            id: FRAK_MERCHANT_ID,
            domain: this.dnsCheck.getNormalizedDomain(params.domain),
            name: "Frak",
            ...("wallet" in params.owner
                ? { ownerWallet: params.owner.wallet }
                : { ownerAccountId: params.owner.accountId }),
            bankAddress: FRAK_SHARED_CAMPAIGN_BANK,
            defaultRewardToken: currentStablecoins.eure,
            verifiedAt: new Date(),
        });
        return { merchant, created: true };
    }

    /** 409 `SIGNUP_RULE_ACTIVE` while one is live: two would both pay every signup. */
    async publishSignupRule(
        input: PublishSignupRuleInput
    ): Promise<CampaignRuleSelect> {
        await this.requireFrakMerchant();
        const [active] = await this.campaignRules.findActiveByMerchant(
            FRAK_MERCHANT_ID,
            interactionTypes.referralSignup
        );
        if (active) {
            throw HttpError.conflict(
                "SIGNUP_RULE_ACTIVE",
                `Signup rule ${active.id} is live; pause it first`
            );
        }
        return this.publishRule({
            name: "Frak Game: referral signup",
            trigger: interactionTypes.referralSignup,
            rewards: [
                ["referrer", input.referrer],
                ["referee", input.referee],
            ],
            budget: input.budget,
            unlockDays: input.unlockDays,
        });
    }

    async listGames(): Promise<GameAdmin[]> {
        const games = await this.games.list();
        const ids = games.map((game) => game.id);
        const [counts, draws] = await Promise.all([
            this.players.participantCounts(ids),
            this.draws.findSummaries(ids),
        ]);
        const drawOf = new Map(draws.map((draw) => [draw.gameId, draw]));
        return Promise.all(
            games.map(async (game) => {
                const [code, rule, sponsor] = await Promise.all([
                    this.referralCodes.findById(game.referralCodeId),
                    this.campaignRules.findById(game.campaignRuleId),
                    game.sponsorMerchantId
                        ? this.merchants.findById(game.sponsorMerchantId)
                        : null,
                ]);
                const draw = drawOf.get(game.id);
                return {
                    id: game.id,
                    code: code?.code ?? "?",
                    status: game.status,
                    startsAt: game.startsAt,
                    endsAt: game.endsAt,
                    createdAt: game.createdAt,
                    prizeAmount: game.prizeAmount,
                    prizeDescription: game.prizeDescription,
                    sponsor: sponsor && {
                        id: sponsor.id,
                        name: sponsor.name,
                        domain: sponsor.domain,
                    },
                    rule: rule && ruleSummary(rule),
                    participants: counts.get(game.id) ?? 0,
                    draw: draw
                        ? {
                              status: draw.status,
                              totalTickets: draw.totalTickets,
                              frozenAt: draw.frozenAt,
                          }
                        : null,
                };
            })
        );
    }

    /** Opens a game on an active Frak code, with its own `game_join` rule; games never overlap. */
    async createGame(
        input: CreateGameInput,
        now = new Date()
    ): Promise<GameSelect> {
        await this.requireFrakMerchant();
        const code = await this.requireFrakCode(input.code);
        if (await this.games.findByReferralCodeId(code.id)) {
            throw HttpError.conflict(
                "CODE_HAS_GAME",
                `Code ${code.code} already has a game`
            );
        }
        const { startsAt, endsAt } = input;
        if (endsAt <= startsAt) {
            throw HttpError.badRequest(
                "INVALID_WINDOW",
                "The game must end after it starts"
            );
        }
        if (endsAt <= now) {
            throw HttpError.badRequest(
                "INVALID_WINDOW",
                "The game must end in the future"
            );
        }
        const overlapping = (await this.games.list()).find(
            (game) =>
                game.endsAt > now &&
                game.startsAt < endsAt &&
                startsAt < game.endsAt
        );
        if (overlapping) {
            throw HttpError.conflict(
                "GAME_WINDOW_OVERLAP",
                `The window overlaps game ${overlapping.id}`
            );
        }
        if (
            input.sponsorMerchantId &&
            !(await this.merchants.findById(input.sponsorMerchantId))
        ) {
            throw HttpError.notFound(
                "SPONSOR_NOT_FOUND",
                "No such sponsor merchant"
            );
        }

        const gameId = randomUUID();
        const rule = await this.publishRule({
            name: `Frak Game ${code.code}`,
            trigger: interactionTypes.gameJoin,
            rewards: [["referee", input.reward]],
            conditions: [
                { field: "game.id", operator: "eq", value: gameId },
                { field: "game.newcomer", operator: "eq", value: true },
            ],
            maxRewardsPerUser: 1,
            expiresAt: new Date(endsAt.getTime() + GAME_RULE_GRACE_MS),
            budget: input.budget,
            unlockDays: input.unlockDays,
        });
        return this.games.create({
            id: gameId,
            referralCodeId: code.id,
            campaignRuleId: rule.id,
            sponsorMerchantId: input.sponsorMerchantId ?? null,
            prizeAmount: input.prizeAmount,
            prizeDescription: input.prizeDescription?.trim() || null,
            startsAt,
            endsAt,
        });
    }

    /** `paused` stops new joins at once; the rule keeps paying joins already recorded. */
    async setStatus(gameId: string, status: GameStatus): Promise<GameSelect> {
        const game = await this.requireGame(gameId);
        const updated = await this.games.setStatus(game.referralCodeId, status);
        if (!updated)
            throw HttpError.notFound("GAME_NOT_FOUND", "No such game");
        return updated;
    }

    async findGameByCode(raw: string): Promise<GameSelect> {
        const code = await this.requireFrakCode(raw);
        const game = await this.games.findByReferralCodeId(code.id);
        if (!game) {
            throw HttpError.notFound(
                "GAME_NOT_FOUND",
                `No game on code ${code.code}`
            );
        }
        return game;
    }

    /** Every player with their tickets: counted live until the freeze, then as frozen. */
    async playersOf(gameId: string, fresh = false): Promise<GamePlayers> {
        const players = await this.playersCache.fetch(gameId, {
            forceRefresh: fresh,
        });
        if (!players)
            throw HttpError.notFound("GAME_NOT_FOUND", "No such game");
        return players;
    }

    private async countPlayers(
        gameId: string
    ): Promise<GamePlayers | undefined> {
        const game = await this.games.findById(gameId);
        if (!game) return undefined;
        const [participants, draw] = await Promise.all([
            this.players.participantsOf(gameId),
            this.draws.findByGameId(gameId),
        ]);
        const rows = draw
            ? draw.entries.map((entry) =>
                  playerRow(entry.identityGroupId, entry.tickets, entry)
              )
            : await this.countLive(game, participants);
        const groupIds = rows.map((row) => row.identityGroupId);
        const [wallets, links, declarations] = await Promise.all([
            this.identities.getWalletsForGroups(groupIds),
            this.instagramLinks.findByIdentityGroups(groupIds),
            this.instagramPendingLinks.findDeclarations(groupIds),
        ]);
        const joinedAt = new Map(
            participants.map((p) => [p.identityGroupId, p.joinedAt])
        );
        const linkOf = new Map(links.map((l) => [l.identityGroupId, l]));
        const declarationOf = new Map(
            declarations.map((d) => [d.identityGroupId, d])
        );

        const players = rows.map((row): GamePlayer => {
            const link = linkOf.get(row.identityGroupId) ?? null;
            const declaration = declarationOf.get(row.identityGroupId) ?? null;
            return {
                ...row,
                eligible: draw
                    ? row.eligible
                    : isDrawEligible(link, declaration),
                wallet: wallets.get(row.identityGroupId) ?? null,
                joinedAt: joinedAt.get(row.identityGroupId) ?? null,
                instagram: {
                    level: instagramLevelOf(link, declaration),
                    username: link?.username ?? declaration?.username ?? null,
                    follows: link?.follows ?? null,
                },
            };
        });
        players.sort((a, b) => b.totalTickets - a.totalTickets);
        return {
            source: draw ? "frozen" : "live",
            computedAt: new Date(),
            players,
        };
    }

    private async countLive(
        game: GameSelect,
        participants: { identityGroupId: string; joinedAt: Date }[]
    ): Promise<PlayerRow[]> {
        const rows: PlayerRow[] = [];
        for (let i = 0; i < participants.length; i += COUNT_CONCURRENCY) {
            const batch = participants.slice(i, i + COUNT_CONCURRENCY);
            const counted = await Promise.all(
                batch.map(async ({ identityGroupId, joinedAt }) =>
                    playerRow(
                        identityGroupId,
                        await this.players.ticketsOf(
                            game,
                            identityGroupId,
                            joinedAt
                        )
                    )
                )
            );
            rows.push(...counted);
        }
        return rows;
    }

    /** `null` until the freeze. A drawn draw re-reads its candidate's follow from Meta. */
    async drawOf(gameId: string): Promise<GameDrawAdmin | null> {
        const stored = await this.draws.findByGameId(gameId);
        if (!stored) return null;
        const review =
            stored.status === "drawn"
                ? await this.gameDraw.review(gameId)
                : null;
        const draw = review?.draw ?? stored;
        const candidate = review?.candidate ?? null;
        return {
            status: draw.status,
            algorithm: draw.algorithm,
            frozenAt: draw.frozenAt,
            snapshotRoot: draw.snapshotRoot,
            totalTickets: draw.totalTickets,
            participants: draw.entries.length,
            eligibleParticipants: draw.entries.filter((e) => e.drawTickets > 0)
                .length,
            drand: {
                round: draw.drandRound,
                roundTime: drandRoundTime(draw.drandRound),
                signed: draw.drandSignature !== null,
            },
            candidates: draw.candidates?.length ?? 0,
            candidateWindow: hasCandidateWindow(draw.algorithm),
            rejections: draw.rejections.map((rejection, rank) => ({
                rank,
                ...rejection,
            })),
            winner: await this.winnerOf(draw),
            candidate: candidate && {
                rank: candidate.rank,
                pid: candidate.pid,
                identityGroupId: candidate.identityGroupId,
                wallet: candidate.wallet,
                accountCreatedAt: candidate.accountCreatedAt,
                instagram: candidate.instagram,
                awaiting: candidate.awaiting,
                verifyBy: candidate.verifyBy,
                drawTickets: candidate.entry.drawTickets,
                tickets: candidate.entry.tickets,
            },
        };
    }

    private async winnerOf(
        draw: GameDrawSelect
    ): Promise<GameDrawAdmin["winner"]> {
        if (!draw.winnerIdentityGroupId) return null;
        const [wallet, [payout]] = await Promise.all([
            this.identities.getWalletForGroup(draw.winnerIdentityGroupId),
            this.assetLogs.findPayoutStates(
                draw.assetLogId ? [draw.assetLogId] : []
            ),
        ]);
        return {
            identityGroupId: draw.winnerIdentityGroupId,
            wallet,
            confirmedBy: draw.confirmedBy,
            confirmedAt: draw.confirmedAt,
            assetLogId: draw.assetLogId,
            payout: payout ? toPayoutState(payout) : null,
        };
    }

    /** Freezes an ended game now, without waiting for the cron (which stops trying 7 days after the end). */
    async freeze(gameId: string): Promise<GameDrawSelect> {
        const game = await this.requireGame(gameId);
        const draw = await this.gameDraw.freeze(game);
        this.playersCache.delete(gameId);
        return draw;
    }

    /** The public record replayed, check by check; 404 `DRAW_NOT_FOUND` before the freeze. */
    async verifyDraw(gameId: string): Promise<DrawCheck[]> {
        const draw = await this.gameDraw.publicDraw(gameId);
        if (!draw) {
            throw HttpError.notFound("DRAW_NOT_FOUND", "Not frozen yet");
        }
        return verifyPublicDraw(draw);
    }

    private async requireGame(gameId: string): Promise<GameSelect> {
        const game = await this.games.findById(gameId);
        if (!game) throw HttpError.notFound("GAME_NOT_FOUND", "No such game");
        return game;
    }

    private async requireFrakCode(raw: string) {
        const code = await this.referralCodes.findByCode(raw.trim());
        if (code?.kind !== "frak") {
            throw HttpError.notFound(
                "CODE_NOT_FOUND",
                `No active Frak code ${raw.trim().toUpperCase()}`
            );
        }
        return code;
    }

    private async requireFrakMerchant(): Promise<void> {
        if (!(await this.merchants.findById(FRAK_MERCHANT_ID))) {
            throw HttpError.conflict(
                "FRAK_MERCHANT_MISSING",
                "Seed the Frak merchant first"
            );
        }
    }

    private async publishRule(params: RuleParams): Promise<CampaignRuleSelect> {
        const rule = await this.campaignManagement.create({
            merchantId: FRAK_MERCHANT_ID,
            name: params.name,
            expiresAt: params.expiresAt,
            rule: {
                trigger: params.trigger,
                conditions: params.conditions ?? [],
                rewards: params.rewards.map(([recipient, amount]) => ({
                    recipient,
                    type: "token",
                    amountType: "fixed",
                    amount,
                })),
                pendingRewardExpirationDays:
                    params.unlockDays ?? DEFAULT_UNLOCK_DAYS,
                maxRewardsPerUser: params.maxRewardsPerUser,
                holdUntilReleased: true,
            },
            budgetConfig: [
                {
                    label: BUDGET_LABEL,
                    durationInSeconds: null,
                    amount: params.budget,
                },
            ],
        });
        return this.campaignManagement.publish(rule.id);
    }
}
