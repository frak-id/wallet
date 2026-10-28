import { randomBytes } from "node:crypto";
import { db, eventEmitter, log, productEvents } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { LRUCache } from "lru-cache";
import { isAddressEqual } from "viem";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import {
    CANDIDATE_REMINDER_MS,
    candidateVerifyBy,
    canonicalEntries,
    currentCandidate,
    DRAND_QUICKNET,
    DRAW_ALGORITHM,
    DRAW_AUTO_FREEZE_WINDOW_MS,
    DRAW_FREEZE_GRACE_MS,
    DRAW_ROUND_DELAY_MS,
    drandRandomness,
    drandRoundAt,
    drandRoundTime,
    drawCandidatesFor,
    drawTicketsOf,
    frozenStandingOf,
    hasCandidateWindow,
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
import type { InstagramPendingLinkRepository } from "../../domain/instagram/repositories/InstagramPendingLinkRepository";
import {
    InstagramUnavailableError,
    type InstagramVerificationService,
} from "../../domain/instagram/services/InstagramVerificationService";
import {
    instagramLevelOf,
    isVerifiedFollower,
} from "../../domain/instagram/utils";
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
/** A follow read this recently is trusted at freeze; older ones are re-read from Meta. */
const FREEZE_FOLLOW_MAX_AGE_MS = 60 * 60 * 1000;
/** How stale a waiting candidate's follow may get between two cron passes. */
const CANDIDATE_RECHECK_MS = 15 * 60 * 1000;

type CandidateNotice = "drawn" | "reminder";

type OutcomeDraw = Awaited<
    ReturnType<GameDrawRepository["findOutcomes"]>
>[number];

function toGameResult({
    summary,
    draw,
    ticketsBySource,
    verifyBy,
    mine,
}: {
    summary: GameResult["game"];
    draw: OutcomeDraw | undefined;
    ticketsBySource: GameResult["ticketsBySource"];
    verifyBy: Date | null;
    mine: ReadonlySet<string>;
}): GameResult {
    return {
        game: summary,
        outcome: verifyBy ? "pending_verification" : outcomeOf(draw, mine),
        verifyBy,
        ticketsBySource,
        drawTickets: draw
            ? (draw.entry?.drawTickets ?? 0)
            : totalTickets(ticketsBySource),
        discarded: draw?.entry?.discarded ?? null,
        pid: draw?.entry?.drawTickets ? draw.entry.pid : null,
        totalTickets: draw?.totalTickets ?? null,
        participants: draw?.participants ?? null,
        confirmedAt: draw?.status === "confirmed" ? draw.confirmedAt : null,
    };
}

/** The caller holds the candidate whose turn it is. */
function isCallerTurn(
    draw: Pick<GameDrawSelect, "status" | "candidates" | "rejections"> & {
        entry: Pick<DrawEntry, "pid"> | null;
    }
): boolean {
    return (
        draw.status === "drawn" &&
        draw.entry !== null &&
        draw.candidates?.[draw.rejections.length] === draw.entry.pid
    );
}

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
        private readonly instagramPendingLinks: Pick<
            InstagramPendingLinkRepository,
            "findDeclaration" | "findDeclarations"
        >,
        private readonly instagramVerification: Pick<
            InstagramVerificationService,
            "recheck"
        >,
        private readonly identities: IdentityRepository,
        private readonly merchants: MerchantRepository,
        private readonly assetLogs: AssetLogRepository,
        private readonly drand: DrandClient
    ) {}

    /**
     * The cron's pass: freeze games that just ended, draw the frozen ones whose round is out, then move each candidate's window.
     * Without `at`, each step reads the clock afresh: a freeze can take minutes, and a push stamps its window.
     */
    async runDue(
        at?: Date
    ): Promise<{ frozen: number; drawn: number; advanced: number }> {
        const clock = () => at ?? new Date();
        let now = clock();
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
        now = clock();
        for (const draw of await this.draws.findByStatus("frozen")) {
            const done = await this.isolated(draw.gameId, "run", () =>
                this.drawFrozen(draw, now)
            );
            if (done) drawn++;
        }

        let advanced = 0;
        for (const draw of await this.draws.findByStatus("drawn")) {
            if (!hasCandidateWindow(draw.algorithm)) continue;
            const done = await this.isolated(draw.gameId, "advance", () =>
                this.advanceCandidate(draw, clock())
            );
            if (done) advanced++;
        }
        return { frozen, drawn, advanced };
    }

    /** One game's failure is logged and skipped, so it never holds back the others. */
    private async isolated(
        gameId: string,
        step: "freeze" | "run" | "advance",
        task: () => Promise<boolean>
    ): Promise<boolean> {
        try {
            return await task();
        } catch (error) {
            // A Meta outage only delays the step: it is retried every pass.
            const level =
                error instanceof InstagramUnavailableError ? "warn" : "error";
            log[level]({ error, gameId }, `Game draw ${step} failed`);
            return false;
        }
    }

    /** Counts every participant's tickets once; certified followers and declared players keep them. */
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
        const groupIds = participants.map((p) => p.identityGroupId);
        // Throws when Meta cannot answer: the freeze retries rather than discard followers.
        await this.instagramVerification.recheck(groupIds, {
            maxAgeMs: FREEZE_FOLLOW_MAX_AGE_MS,
        });
        const [links, declarations] = await Promise.all([
            this.instagramLinks.findByIdentityGroups(groupIds),
            this.instagramPendingLinks.findDeclarations(groupIds),
        ]);
        const linkOf = new Map(links.map((l) => [l.identityGroupId, l]));
        const declared = new Set(declarations.map((d) => d.identityGroupId));
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
                    const standing = frozenStandingOf(
                        linkOf.get(identityGroupId) ?? null,
                        declared.has(identityGroupId)
                    );
                    return {
                        pid: pseudonymOf(pidKey, identityGroupId),
                        identityGroupId,
                        tickets,
                        drawTickets: standing.discarded
                            ? 0
                            : totalTickets(tickets),
                        ...standing,
                    } satisfies DrawEntry;
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

        const count = drawCandidatesFor(draw.algorithm);
        if (count === null) {
            throw new Error(`Unknown draw algorithm ${draw.algorithm}`);
        }
        const candidates = rankCandidates({
            randomness: drandRandomness(beacon.signature),
            gameId: draw.gameId,
            entries: drawTicketsOf(draw.entries),
            count,
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

    /**
     * Moves the current candidate's turn on: a certified follower waits for the
     * admin; anyone else is told once, reminded once, and passed over when their
     * 24 h run out. Loops so the next candidate is told in the same pass.
     */
    private async advanceCandidate(
        draw: GameDrawSelect,
        now: Date
    ): Promise<boolean> {
        let current = draw;
        let changed = false;
        for (let step = 0; step <= (draw.candidates?.length ?? 0); step++) {
            const outcome = await this.stepCandidate(current, now);
            if (outcome.kind === "stop") return changed || outcome.changed;
            current = outcome.draw;
            changed = true;
        }
        return changed;
    }

    /** One candidate's turn: `passed` hands the updated draw to the next one. */
    private async stepCandidate(
        draw: GameDrawSelect,
        now: Date
    ): Promise<
        | { kind: "stop"; changed: boolean }
        | { kind: "passed"; draw: GameDrawSelect }
    > {
        const stop = (changed: boolean) => ({ kind: "stop" as const, changed });
        const candidate =
            draw.status === "drawn" ? currentCandidate(draw) : null;
        if (!candidate) return stop(false);
        const groupId = await this.survivingGroupOf(
            candidate.entry.identityGroupId
        );
        if (await this.isVerifiedFollower(groupId, CANDIDATE_RECHECK_MS)) {
            return stop(false);
        }

        const notice = this.dueNotice(draw, candidate.rank, now);
        if (notice) {
            return stop(
                await this.noticeCandidate(
                    draw,
                    candidate.rank,
                    groupId,
                    notice,
                    now
                )
            );
        }
        const verifyBy = candidateVerifyBy(draw, candidate.rank);
        if (!verifyBy || now < verifyBy) return stop(false);
        // One fresh read, so a follow made minutes before the deadline still counts.
        if (await this.isVerifiedFollower(groupId, 0)) return stop(false);
        const rejected = await this.recordRejection(
            draw,
            candidate,
            "not_verified_in_time",
            "system",
            now
        );
        return rejected ? { kind: "passed", draw: rejected } : stop(false);
    }

    /** `drawn` until the candidate is told; `reminder` once, near the end of their window. */
    private dueNotice(
        draw: GameDrawSelect,
        rank: number,
        now: Date
    ): CandidateNotice | null {
        const verifyBy = candidateVerifyBy(draw, rank);
        if (!verifyBy) return "drawn";
        const remindFrom = verifyBy.getTime() - CANDIDATE_REMINDER_MS;
        if (draw.remindedRank < rank && now.getTime() >= remindFrom) {
            return now < verifyBy ? "reminder" : null;
        }
        return null;
    }

    /** Marks before sending, so a crash can lose a push but never send it twice. */
    private async noticeCandidate(
        draw: GameDrawSelect,
        rank: number,
        groupId: string,
        notice: CandidateNotice,
        now: Date
    ): Promise<boolean> {
        const marked = await this.draws.markCandidateNotified({
            id: draw.id,
            rank,
            kind: notice,
            at: now,
        });
        if (!marked) return false;
        if (notice === "drawn") {
            productEvents.track("game_candidate_window_started", groupId, {
                game_id: draw.gameId,
                rank: rank + 1,
            });
        }

        const [game, wallet] = await Promise.all([
            this.games.findById(draw.gameId),
            this.walletOf(groupId),
        ]);
        if (game && wallet) {
            const verifyBy = candidateVerifyBy(
                notice === "drawn"
                    ? { notifiedRank: rank, candidateNotifiedAt: now }
                    : draw,
                rank
            );
            if (!verifyBy) return true;
            eventEmitter.emit("notification", {
                type:
                    notice === "drawn"
                        ? "game_candidate_drawn"
                        : "game_candidate_reminder",
                wallet,
                prizeAmount: game.prizeAmount,
                verifyBy,
            });
        }
        return true;
    }

    private async survivingGroupOf(identityGroupId: string): Promise<string> {
        return (
            (await this.identities.findSurvivingGroupId(identityGroupId)) ??
            identityGroupId
        );
    }

    /** Certified and following now, re-read from Meta when older than `maxAgeMs`. Throws when Meta cannot say. */
    private async isVerifiedFollower(
        groupId: string,
        maxAgeMs: number
    ): Promise<boolean> {
        await this.instagramVerification.recheck([groupId], { maxAgeMs });
        return isVerifiedFollower(
            await this.instagramLinks.findByIdentityGroup(groupId)
        );
    }

    /** What an admin needs to judge the current candidate, re-read now. */
    async review(gameId: string) {
        const draw = await this.requireDraw(gameId);
        const candidate = currentCandidate(draw);
        if (!candidate) return { draw, candidate: null };

        const groupId = await this.survivingGroupOf(
            candidate.entry.identityGroupId
        );
        const followFresh = await this.instagramVerification
            .recheck([groupId], { maxAgeMs: 0 })
            .then(() => true)
            .catch((error: unknown) => {
                if (error instanceof InstagramUnavailableError) return false;
                throw error;
            });
        const [group, wallet, link, declaration] = await Promise.all([
            this.identities.findGroupById(groupId),
            this.identities.getWalletForGroup(groupId),
            this.instagramLinks.findByIdentityGroup(groupId),
            this.instagramPendingLinks.findDeclaration(groupId),
        ]);
        const verified = isVerifiedFollower(link);
        return {
            draw,
            candidate: {
                ...candidate,
                identityGroupId: groupId,
                wallet,
                accountCreatedAt: group?.createdAt ?? null,
                instagram: {
                    level: instagramLevelOf(link, declaration),
                    username: link?.username ?? declaration?.username ?? null,
                    follows: link?.follows ?? null,
                    checkedAt: link?.checkedAt ?? null,
                    followFresh,
                },
                awaiting: verified ? ("admin" as const) : ("player" as const),
                verifyBy: verified
                    ? null
                    : candidateVerifyBy(draw, candidate.rank),
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
        const updated = await this.recordRejection(
            draw,
            candidate,
            reason,
            actor,
            new Date()
        );
        if (!updated) throw this.reviewedMeanwhile();
        return updated;
    }

    /** `null` when someone reviewed the draw meanwhile; the last candidate's rejection voids it. */
    private async recordRejection(
        draw: GameDrawSelect,
        candidate: { rank: number; pid: string },
        reason: DrawRejectionReason,
        actor: string,
        at: Date
    ): Promise<GameDrawSelect | null> {
        const updated = await this.draws.addRejection({
            id: draw.id,
            reviewed: candidate.rank,
            rejection: {
                pid: candidate.pid,
                reason,
                actor,
                at: at.toISOString(),
            },
            exhausted: candidate.rank + 1 >= (draw.candidates?.length ?? 0),
        });
        if (!updated) return null;
        productEvents.track("game_winner_rejected", null, {
            game_id: draw.gameId,
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
        await this.requireVerifiedWinner(winner);
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

    /** 409 `CANDIDATE_NOT_VERIFIED` unless certified and following now; 502 when Meta cannot say. */
    private async requireVerifiedWinner(groupId: string): Promise<void> {
        let verified: boolean;
        try {
            verified = await this.isVerifiedFollower(groupId, 0);
        } catch (error) {
            if (!(error instanceof InstagramUnavailableError)) throw error;
            throw HttpError.badGateway(
                "INSTAGRAM_UNAVAILABLE",
                "Instagram cannot confirm the candidate's follow right now"
            );
        }
        if (!verified) {
            throw HttpError.conflict(
                "CANDIDATE_NOT_VERIFIED",
                "The candidate must certify their Instagram and follow @frak_fr first; wait for their window or reject them"
            );
        }
    }

    /** A failed lookup only costs a push. */
    private async walletOf(identityGroupId: string) {
        return this.identities
            .getWalletForGroup(identityGroupId)
            .catch((error: unknown) => {
                log.warn(
                    { error, identityGroupId },
                    "Game player's wallet lookup failed, no push sent"
                );
                return null;
            });
    }

    /** The prize is paid by now, so a failed lookup only costs the push. */
    private async notifyWinner(identityGroupId: string, prizeAmount: number) {
        const wallet = await this.walletOf(identityGroupId);
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
        const awaitingMe = [...draws.values()].some(isCallerTurn);
        const verified =
            awaitingMe &&
            isVerifiedFollower(
                await this.instagramLinks.findByIdentityGroup(identityGroupId)
            );
        return Promise.all(
            shown.map(async (game) => {
                const draw = draws.get(game.id);
                const from = joinedAt.get(game.id) ?? game.startsAt;
                const ticketsBySource = draw
                    ? (draw.entry?.tickets ?? NO_TICKETS)
                    : await this.players.ticketsOf(game, identityGroupId, from);
                const verifyBy =
                    draw && isCallerTurn(draw) && !verified
                        ? candidateVerifyBy(draw, draw.rejections.length)
                        : null;
                return toGameResult({
                    summary: await summarizeGame(game, this.merchants),
                    draw,
                    ticketsBySource,
                    verifyBy,
                    mine,
                });
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
