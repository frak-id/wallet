import { randomBytes } from "node:crypto";
import { db, eventEmitter, log, productEvents } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { LRUCache } from "lru-cache";
import { isAddressEqual } from "viem";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import {
    canonicalEntries,
    currentCandidate,
    DRAND_QUICKNET,
    DRAW_ALGORITHM,
    DRAW_AUTO_FREEZE_WINDOW_MS,
    DRAW_CANDIDATES,
    DRAW_FREEZE_GRACE_MS,
    DRAW_ROUND_DELAY_MS,
    drandRandomness,
    drandRoundAt,
    drandRoundTime,
    drawTicketsOf,
    isDrawSettled,
    outcomeOf,
    pseudonymOf,
    rankCandidates,
    snapshotRoot,
    verifyDrandBeacon,
} from "../../domain/game/draw";
import type { GameDrawRepository } from "../../domain/game/repositories/GameDrawRepository";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type {
    DrawEntry,
    DrawRejectionReason,
    GameResult,
    PublicDraw,
} from "../../domain/game/schemas";
import { NO_TICKETS, totalTickets } from "../../domain/game/tickets";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { InstagramLinkRepository } from "../../domain/instagram/repositories/InstagramLinkRepository";
import { isInstagramEligible } from "../../domain/instagram/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { DrandClient } from "../../infrastructure/integrations/drand";
import type { GamePlayerOrchestrator } from "./GamePlayerOrchestrator";
import { summarizeGame } from "./summarizeGame";

const COUNT_CONCURRENCY = 10;
const RESULTS_LIMIT = 20;
/** How long a replica serves a public record that can still change; an admin review runs in another process. */
const LIVE_DRAW_TTL_MS = 30 * 1000;
const SETTLED_DRAW_TTL_MS = 60 * 60 * 1000;

export class GameDrawOrchestrator {
    private readonly publicDraws = new LRUCache<
        string,
        { draw: PublicDraw | null }
    >({
        max: 16,
        ttl: LIVE_DRAW_TTL_MS,
        fetchMethod: async (gameId, _stale, { options }) => {
            const draw = await this.loadPublicDraw(gameId);
            if (draw && isDrawSettled(draw)) options.ttl = SETTLED_DRAW_TTL_MS;
            return { draw };
        },
    });

    constructor(
        private readonly games: GameRepository,
        private readonly draws: GameDrawRepository,
        private readonly players: Pick<
            GamePlayerOrchestrator,
            "participantsOf" | "ticketsOf" | "gamesJoinedBy"
        >,
        private readonly instagramLinks: InstagramLinkRepository,
        private readonly identities: IdentityRepository,
        private readonly merchants: MerchantRepository,
        private readonly assetLogs: AssetLogRepository,
        private readonly drand: DrandClient
    ) {}

    /** The cron's pass: freeze games that just ended, then draw the frozen ones whose round is out. */
    async runDue(now = new Date()): Promise<{ frozen: number; drawn: number }> {
        const ended = await this.games.findEndedBetween(
            new Date(now.getTime() - DRAW_AUTO_FREEZE_WINDOW_MS),
            new Date(now.getTime() - DRAW_FREEZE_GRACE_MS)
        );
        let frozen = 0;
        for (const game of ended) {
            const done = await this.isolated(game.id, "freeze", async () => {
                if (await this.draws.findByGameId(game.id)) return false;
                await this.freeze(game, now);
                return true;
            });
            if (done) frozen++;
        }

        let drawn = 0;
        for (const draw of await this.draws.findByStatus("frozen")) {
            const done = await this.isolated(draw.gameId, "run", () =>
                this.drawFrozen(draw, now)
            );
            if (done) drawn++;
        }
        return { frozen, drawn };
    }

    /** One game's failure is logged and skipped, so it never holds back the others. */
    private async isolated(
        gameId: string,
        step: "freeze" | "run",
        task: () => Promise<boolean>
    ): Promise<boolean> {
        try {
            return await task();
        } catch (error) {
            log.error({ error, gameId }, `Game draw ${step} failed`);
            return false;
        }
    }

    /** Counts every participant's tickets once; only followers of @frak_fr keep them. */
    async freeze(game: GameSelect, now = new Date()): Promise<GameDrawSelect> {
        if (game.endsAt > now) {
            throw HttpError.conflict("GAME_NOT_ENDED", "The game is still on");
        }
        const existing = await this.draws.findByGameId(game.id);
        if (existing) return existing;

        const { pidKey, list } = await this.countEntries(game);
        const total = list.reduce((sum, e) => sum + e.drawTickets, 0);
        // Counting takes time: the round must follow the moment the root is stored.
        const frozenAt = new Date();
        const round = drandRoundAt(
            new Date(frozenAt.getTime() + DRAW_ROUND_DELAY_MS)
        );
        const created = await this.draws.create({
            gameId: game.id,
            algorithm: DRAW_ALGORITHM,
            status: total > 0 ? "frozen" : "void",
            frozenAt,
            pidKey,
            snapshotRoot: snapshotRoot(drawTicketsOf(list)),
            totalTickets: total,
            entries: list,
            drandChainHash: DRAND_QUICKNET.chainHash,
            drandRound: round,
        });
        if (!created) {
            const raced = await this.draws.findByGameId(game.id);
            if (!raced) throw new Error(`Draw for game ${game.id} vanished`);
            return raced;
        }

        log.info(
            { gameId: game.id, root: created.snapshotRoot, round, total },
            "Game draw frozen"
        );
        productEvents.track("game_draw_frozen", null, {
            game_id: game.id,
            participants: list.length,
            eligible_participants: list.filter((e) => e.drawTickets > 0).length,
            total_tickets: total,
            drand_round: round,
        });
        return created;
    }

    private async countEntries(
        game: GameSelect
    ): Promise<{ pidKey: string; list: DrawEntry[] }> {
        const participants = await this.players.participantsOf(game.id);
        const links = await this.instagramLinks.findByIdentityGroups(
            participants.map((p) => p.identityGroupId)
        );
        const following = new Set(
            links
                .filter((link) => isInstagramEligible(link))
                .map((link) => link.identityGroupId)
        );
        const pidKey = randomBytes(32).toString("hex");

        const list: DrawEntry[] = [];
        for (let i = 0; i < participants.length; i += COUNT_CONCURRENCY) {
            const batch = participants.slice(i, i + COUNT_CONCURRENCY);
            const counted = await Promise.all(
                batch.map(async ({ identityGroupId, joinedAt }) => {
                    const tickets = await this.players.ticketsOf(
                        game,
                        identityGroupId,
                        joinedAt
                    );
                    const follows = following.has(identityGroupId);
                    return {
                        pid: pseudonymOf(pidKey, identityGroupId),
                        identityGroupId,
                        tickets,
                        drawTickets: follows ? totalTickets(tickets) : 0,
                        discarded: follows ? null : ("not_following" as const),
                    };
                })
            );
            list.push(...counted);
        }
        list.sort((a, b) => (a.pid < b.pid ? -1 : 1));
        return { pidKey, list };
    }

    /** `false` while the round is not out, or no relay could serve it. */
    private async drawFrozen(
        draw: GameDrawSelect,
        now: Date
    ): Promise<boolean> {
        if (drandRoundTime(draw.drandRound) > now) return false;
        const beacon = await this.drand.fetchBeacon(
            draw.drandChainHash,
            draw.drandRound,
            (signature) => verifyDrandBeacon(draw.drandRound, signature)
        );
        if (beacon.kind !== "found") {
            log.warn(
                { gameId: draw.gameId, round: draw.drandRound, beacon },
                "Game draw waiting on its drand round"
            );
            return false;
        }

        const candidates = rankCandidates({
            randomness: drandRandomness(beacon.signature),
            gameId: draw.gameId,
            entries: drawTicketsOf(draw.entries),
            count: DRAW_CANDIDATES,
        });
        const drawn = await this.draws.recordBeacon({
            id: draw.id,
            signature: beacon.signature,
            candidates,
        });
        if (!drawn) return false;

        log.info(
            { gameId: draw.gameId, candidates: candidates.length },
            "Game draw run"
        );
        productEvents.track("game_draw_run", null, {
            game_id: draw.gameId,
            candidates: candidates.length,
        });
        return true;
    }

    /** What an admin needs to judge the current candidate, re-read now. */
    async review(gameId: string) {
        const draw = await this.requireDraw(gameId);
        const candidate = currentCandidate(draw);
        if (!candidate) return { draw, candidate: null };

        const groupId =
            (await this.identities.findSurvivingGroupId(
                candidate.entry.identityGroupId
            )) ?? candidate.entry.identityGroupId;
        const [group, wallet, [link]] = await Promise.all([
            this.identities.findGroupById(groupId),
            this.identities.getWalletForGroup(groupId),
            this.instagramLinks.findByIdentityGroups([groupId]),
        ]);
        return {
            draw,
            candidate: {
                ...candidate,
                identityGroupId: groupId,
                wallet,
                accountCreatedAt: group?.createdAt ?? null,
                instagram: link
                    ? { username: link.username, follows: link.follows }
                    : null,
            },
        };
    }

    async reject(
        gameId: string,
        reason: DrawRejectionReason,
        actor: string
    ): Promise<GameDrawSelect> {
        const draw = await this.requireDraw(gameId);
        const candidate = this.requireCandidate(draw);
        const updated = await this.draws.addRejection({
            id: draw.id,
            reviewed: candidate.rank,
            rejection: {
                pid: candidate.pid,
                reason,
                actor,
                at: new Date().toISOString(),
            },
            exhausted: candidate.rank + 1 >= (draw.candidates?.length ?? 0),
        });
        if (!updated) throw this.reviewedMeanwhile();

        productEvents.track("game_winner_rejected", null, {
            game_id: gameId,
            rank: candidate.rank + 1,
            reason,
        });
        return updated;
    }

    /** Pays the current candidate the prize, in the same transaction that closes the draw. */
    async confirm(gameId: string, actor: string): Promise<GameDrawSelect> {
        const draw = await this.requireDraw(gameId);
        const candidate = this.requireCandidate(draw);
        const game = await this.games.findById(gameId);
        if (!game) throw HttpError.notFound("GAME_NOT_FOUND", "No such game");

        const winner = await this.identities.findSurvivingGroupId(
            candidate.entry.identityGroupId
        );
        if (!winner) {
            throw HttpError.conflict(
                "WINNER_NOT_FOUND",
                "The candidate's identity no longer exists; reject them"
            );
        }
        const token =
            await this.merchants.getDefaultRewardToken(FRAK_MERCHANT_ID);
        if (!(token && isAddressEqual(token, currentStablecoins.eure))) {
            throw HttpError.internal(
                "PRIZE_TOKEN_NOT_EURE",
                "The Frak merchant must pay in EURe for a EUR prize"
            );
        }

        const confirmed = await db.transaction(async (tx) => {
            const assetLogId = await this.assetLogs.createWinnerPayout(
                {
                    identityGroupId: winner,
                    merchantId: FRAK_MERCHANT_ID,
                    amount: game.prizeAmount,
                    tokenAddress: token,
                },
                tx
            );
            const closed = await this.draws.confirm(
                {
                    id: draw.id,
                    reviewed: candidate.rank,
                    winnerIdentityGroupId: winner,
                    confirmedBy: actor,
                    assetLogId,
                },
                tx
            );
            // Throwing rolls the payout back with it.
            if (!closed) throw this.reviewedMeanwhile();
            return closed;
        });

        eventEmitter.emit("newPendingRewards", { count: 1 });
        productEvents.track("game_winner_confirmed", winner, {
            game_id: gameId,
            rank: candidate.rank + 1,
            prize_amount: game.prizeAmount,
        });
        await this.notifyWinner(winner, game.prizeAmount);
        return confirmed;
    }

    /** The prize is paid by now, so a failed lookup only costs the push. */
    private async notifyWinner(identityGroupId: string, prizeAmount: number) {
        const wallet = await this.identities
            .getWalletForGroup(identityGroupId)
            .catch((error: unknown) => {
                log.warn(
                    { error, identityGroupId },
                    "Game winner's wallet lookup failed, no push sent"
                );
                return null;
            });
        if (!wallet) return;
        eventEmitter.emit("notification", {
            type: "game_won",
            wallet,
            prizeAmount,
        });
    }

    /** `null` until the game is frozen. */
    async publicDraw(gameId: string): Promise<PublicDraw | null> {
        const cached = await this.publicDraws.fetch(gameId);
        return cached?.draw ?? null;
    }

    private async loadPublicDraw(gameId: string): Promise<PublicDraw | null> {
        const draw = await this.draws.findByGameId(gameId);
        if (!draw) return null;
        const winner =
            draw.status === "confirmed" ? currentCandidate(draw) : null;
        const payoutTxHash = draw.assetLogId
            ? await this.assetLogs.findOnchainTxHash(draw.assetLogId)
            : null;
        return {
            gameId: draw.gameId,
            algorithm: draw.algorithm,
            status: draw.status,
            frozenAt: draw.frozenAt,
            snapshotRoot: draw.snapshotRoot,
            totalTickets: draw.totalTickets,
            participants: draw.entries.length,
            discardedParticipants: draw.entries.filter((e) => e.discarded)
                .length,
            entries: canonicalEntries(drawTicketsOf(draw.entries)),
            drand: {
                chainHash: draw.drandChainHash,
                round: draw.drandRound,
                roundTime: drandRoundTime(draw.drandRound),
                signature: draw.drandSignature,
                randomness: draw.drandSignature
                    ? drandRandomness(draw.drandSignature)
                    : null,
            },
            candidates: draw.candidates ?? [],
            rejections: draw.rejections.map(({ pid, reason, at }) => ({
                pid,
                reason,
                at,
            })),
            winnerPid: winner?.pid ?? null,
            payoutTxHash,
        };
    }

    /**
     * The caller's ended games, latest first. A game with no draw past the
     * auto-freeze window is left out: no draw will run for it unless frozen by hand.
     */
    async results(
        identityGroupId: string,
        now = new Date()
    ): Promise<GameResult[]> {
        const joined = await this.players.gamesJoinedBy(identityGroupId);
        const ended = (
            await this.games.findByIds(joined.map((j) => j.gameId))
        ).filter((game) => game.endsAt <= now);
        if (ended.length === 0) return [];

        const mine = await this.groupsOf(identityGroupId);
        const draws = new Map(
            (
                await this.draws.findOutcomes(
                    ended.map((game) => game.id),
                    [...mine]
                )
            ).map((draw) => [draw.gameId, draw])
        );
        const joinedAt = new Map(joined.map((j) => [j.gameId, j.joinedAt]));
        const autoFreezeAfter = now.getTime() - DRAW_AUTO_FREEZE_WINDOW_MS;

        const shown = ended
            .filter(
                (game) =>
                    draws.has(game.id) ||
                    game.endsAt.getTime() > autoFreezeAfter
            )
            .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())
            .slice(0, RESULTS_LIMIT);
        return Promise.all(
            shown.map(async (game) => {
                const draw = draws.get(game.id);
                const from = joinedAt.get(game.id) ?? game.startsAt;
                const ticketsBySource = draw
                    ? (draw.entry?.tickets ?? NO_TICKETS)
                    : await this.players.ticketsOf(game, identityGroupId, from);
                return {
                    game: await summarizeGame(game, this.merchants),
                    outcome: outcomeOf(draw, mine),
                    ticketsBySource,
                    drawTickets: draw
                        ? (draw.entry?.drawTickets ?? 0)
                        : totalTickets(ticketsBySource),
                    discarded: draw?.entry?.discarded ?? null,
                    pid: draw?.entry?.drawTickets ? draw.entry.pid : null,
                    totalTickets: draw?.totalTickets ?? null,
                    participants: draw?.participants ?? null,
                    confirmedAt:
                        draw?.status === "confirmed" ? draw.confirmedAt : null,
                };
            })
        );
    }

    /** The caller's group and every group merged into it. */
    private async groupsOf(identityGroupId: string): Promise<Set<string>> {
        const group = await this.identities.findGroupById(identityGroupId);
        return new Set([
            identityGroupId,
            ...(group?.mergedGroups ?? []).map((m) => m.groupId),
        ]);
    }

    private async requireDraw(gameId: string): Promise<GameDrawSelect> {
        const draw = await this.draws.findByGameId(gameId);
        if (!draw) throw HttpError.notFound("DRAW_NOT_FOUND", "Not frozen yet");
        return draw;
    }

    private requireCandidate(draw: GameDrawSelect) {
        const candidate =
            draw.status === "drawn" ? currentCandidate(draw) : null;
        if (!candidate) {
            throw HttpError.conflict(
                "DRAW_NOT_UNDER_REVIEW",
                `The draw is ${draw.status}, with nobody to review`
            );
        }
        return candidate;
    }

    private reviewedMeanwhile() {
        return HttpError.conflict(
            "DRAW_REVIEWED_MEANWHILE",
            "Someone reviewed this draw meanwhile; look again"
        );
    }
}
