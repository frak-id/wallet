import { randomBytes } from "node:crypto";
import { db, eventEmitter, log, productEvents } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import { isAddressEqual } from "viem";
import type { GameDrawSelect, GameSelect } from "../../domain/game/db/schema";
import {
    canonicalEntries,
    DRAND_QUICKNET,
    DRAW_ALGORITHM,
    DRAW_CANDIDATES,
    drandRandomness,
    drandRoundAt,
    drandRoundTime,
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
    PublicDraw,
} from "../../domain/game/schemas";
import { totalTickets } from "../../domain/game/tickets";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { InstagramLinkRepository } from "../../domain/instagram/repositories/InstagramLinkRepository";
import { isInstagramEligible } from "../../domain/instagram/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { DrandClient } from "../../infrastructure/integrations/drand";
import type { GamePlayerOrchestrator } from "./GamePlayerOrchestrator";

/** Lets refunds right after the end land before tickets are frozen. */
export const DRAW_FREEZE_GRACE_MS = 60 * 60 * 1000;
/** The beacon is emitted this long after the freeze is published. */
export const DRAW_ROUND_DELAY_MS = 10 * 60 * 1000;
/** Older games are only frozen by hand, so a deploy never draws a long-finished game. */
export const DRAW_AUTO_FREEZE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COUNT_CONCURRENCY = 10;

/** The candidate under review: `candidates[rejections.length]`. */
function currentCandidate(draw: GameDrawSelect) {
    const rank = draw.rejections.length;
    const pid = draw.candidates?.[rank];
    const entry = draw.entries.find((e) => e.pid === pid);
    return pid && entry ? { rank, pid, entry } : null;
}

function drawTicketsOf(entries: DrawEntry[]) {
    return entries.map(({ pid, drawTickets }) => ({
        pid,
        tickets: drawTickets,
    }));
}

export class GameDrawOrchestrator {
    constructor(
        private readonly games: GameRepository,
        private readonly draws: GameDrawRepository,
        private readonly players: Pick<
            GamePlayerOrchestrator,
            "participantsOf" | "ticketsOf"
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
            if (await this.draws.findByGameId(game.id)) continue;
            await this.freeze(game, now);
            frozen++;
        }

        let drawn = 0;
        for (const draw of await this.draws.findByStatus("frozen")) {
            if (await this.drawFrozen(draw, now)) drawn++;
        }
        return { frozen, drawn };
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
        const round = drandRoundAt(
            new Date(now.getTime() + DRAW_ROUND_DELAY_MS)
        );
        const created = await this.draws.create({
            gameId: game.id,
            algorithm: DRAW_ALGORITHM,
            status: total > 0 ? "frozen" : "void",
            frozenAt: now,
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
        return confirmed;
    }

    /** `null` until the game is frozen. */
    async publicDraw(gameId: string): Promise<PublicDraw | null> {
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

    /** The caller's line, found through any group merged into theirs since the freeze. */
    async myEntry(gameId: string, identityGroupId: string) {
        const draw = await this.draws.findByGameId(gameId);
        if (!draw) return null;
        const group = await this.identities.findGroupById(identityGroupId);
        const mine = new Set([
            identityGroupId,
            ...(group?.mergedGroups ?? []).map((m) => m.groupId),
        ]);
        const entry = draw.entries.find((e) => mine.has(e.identityGroupId));
        return entry
            ? {
                  pid: entry.pid,
                  drawTickets: entry.drawTickets,
                  discarded: entry.discarded,
              }
            : null;
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
