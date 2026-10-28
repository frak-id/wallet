import { createHash, createHmac } from "node:crypto";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import type { GameDrawSelect } from "./db/schema";
import type { DrawEntry, GameOutcome, PublicDraw } from "./schemas";

/** Bumped whenever anything below changes what a draw picks, so old records still replay. */
export const DRAW_ALGORITHM = "frak-draw-v2";

/** Per algorithm: ranked candidates (`rankCandidates` keeps its prefix as the count grows), and whether the 24 h window applies. */
const ALGORITHMS: Record<
    string,
    { candidates: number; candidateWindow: boolean }
> = {
    "frak-draw-v1": { candidates: 10, candidateWindow: false },
    // Declared players who never certify each pass the turn on.
    "frak-draw-v2": { candidates: 30, candidateWindow: true },
};

/** `null` for an algorithm this code cannot replay. */
export function drawCandidatesFor(algorithm: string): number | null {
    return ALGORITHMS[algorithm]?.candidates ?? null;
}

/** v1 draws froze followers only, so their candidates stay with the admin. */
export function hasCandidateWindow(algorithm: string): boolean {
    return ALGORITHMS[algorithm]?.candidateWindow ?? false;
}

/** How long the current candidate has to be certified and following before the next one's turn. */
export const CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** The reminder push goes out this long before the window closes. */
export const CANDIDATE_REMINDER_MS = 4 * 60 * 60 * 1000;

/** Lets refunds right after the end land before tickets are frozen. */
export const DRAW_FREEZE_GRACE_MS = 60 * 60 * 1000;
/** The beacon is emitted this long after the freeze is published. */
export const DRAW_ROUND_DELAY_MS = 10 * 60 * 1000;
/** Older games are only frozen by hand, so a deploy never draws a long-finished game. */
export const DRAW_AUTO_FREEZE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** League of Entropy `quicknet`: a round every 3 s, unchained G1 signatures (RFC 9380). */
export const DRAND_QUICKNET = {
    chainHash:
        "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    publicKey:
        "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
    genesisTime: 1692803367,
    periodSeconds: 3,
} as const;

export type DrawTicketEntry = { pid: string; tickets: number };

/** The draw's weights: each frozen entry's counted tickets. */
export function drawTicketsOf(entries: DrawEntry[]): DrawTicketEntry[] {
    return entries.map(({ pid, drawTickets }) => ({
        pid,
        tickets: drawTickets,
    }));
}

/** The candidate under review: `candidates[rejections.length]`. */
export function currentCandidate(
    draw: Pick<GameDrawSelect, "candidates" | "entries" | "rejections">
) {
    const rank = draw.rejections.length;
    const pid = draw.candidates?.[rank];
    const entry = draw.entries.find((e) => e.pid === pid);
    return pid && entry ? { rank, pid, entry } : null;
}

/** The window opens when the candidate is told: null until then, so no deadline is shown before it is real. */
export function candidateVerifyBy(
    draw: Pick<GameDrawSelect, "notifiedRank" | "candidateNotifiedAt">,
    rank: number
): Date | null {
    if (draw.notifiedRank !== rank || !draw.candidateNotifiedAt) return null;
    return new Date(draw.candidateNotifiedAt.getTime() + CANDIDATE_WINDOW_MS);
}

/** How a participant's Instagram stood at freeze: who keeps their tickets, and why not. */
export function frozenStandingOf(
    link: { follows: boolean } | null,
    declared: boolean
): Pick<DrawEntry, "discarded" | "instagram"> {
    if (link) {
        return {
            discarded: link.follows ? null : "not_following",
            instagram: "certified",
        };
    }
    if (declared) return { discarded: null, instagram: "declared" };
    return { discarded: "not_linked" };
}

/** How the draw went for a player owning `mine`; `drawing` until a winner is confirmed. */
export function outcomeOf(
    draw: Pick<GameDrawSelect, "status" | "winnerIdentityGroupId"> | undefined,
    mine: ReadonlySet<string>
): GameOutcome {
    if (draw?.status === "void") return "no_winner";
    if (draw?.status !== "confirmed") return "drawing";
    return draw.winnerIdentityGroupId && mine.has(draw.winnerIdentityGroupId)
        ? "won"
        : "lost";
}

/** Nothing left to change on the public record: void, or paid on-chain. */
export function isDrawSettled(
    draw: Pick<PublicDraw, "status" | "payoutTxHash">
): boolean {
    return (
        draw.status === "void" ||
        (draw.status === "confirmed" && draw.payoutTxHash !== null)
    );
}

const TWO_POW_256 = 1n << 256n;

function sha256(...parts: (Buffer | string)[]): Buffer {
    const hash = createHash("sha256");
    for (const part of parts) hash.update(part);
    return hash.digest();
}

function u64be(value: bigint): Buffer {
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(value);
    return bytes;
}

/** First round emitted at or after `at`. */
export function drandRoundAt(at: Date): number {
    const { genesisTime, periodSeconds } = DRAND_QUICKNET;
    const elapsed = at.getTime() / 1000 - genesisTime;
    return Math.max(1, Math.ceil(elapsed / periodSeconds) + 1);
}

export function drandRoundTime(round: number): Date {
    const { genesisTime, periodSeconds } = DRAND_QUICKNET;
    return new Date((genesisTime + (round - 1) * periodSeconds) * 1000);
}

/** The beacon is genuine only if quicknet's group key signed this exact round. */
export function verifyDrandBeacon(round: number, signature: string): boolean {
    const bls = bls12_381.shortSignatures;
    const message = bls.hash(sha256(u64be(BigInt(round))));
    try {
        return bls.verify(
            Buffer.from(signature, "hex"),
            message,
            Buffer.from(DRAND_QUICKNET.publicKey, "hex")
        );
    } catch {
        // A malformed point is a forged beacon, not a crash.
        return false;
    }
}

/** drand's `randomness` field: what the draw is seeded with. */
export function drandRandomness(signature: string): string {
    return sha256(Buffer.from(signature, "hex")).toString("hex");
}

/** Stable per draw, unguessable without the draw's key, so the public list names nobody. */
export function pseudonymOf(pidKey: string, identityGroupId: string): string {
    return createHmac("sha256", pidKey)
        .update(identityGroupId)
        .digest("hex")
        .slice(0, 32);
}

/** Entries holding tickets, sorted by pid: the order every count below walks. */
export function canonicalEntries<T extends DrawTicketEntry>(entries: T[]): T[] {
    return entries
        .filter((entry) => entry.tickets > 0)
        .sort((a, b) => (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : 0));
}

/** One `pid,tickets` line per entry, newline-terminated: the published text the root hashes. */
export function canonicalList(entries: DrawTicketEntry[]): string {
    return canonicalEntries(entries)
        .map((entry) => `${entry.pid},${entry.tickets}\n`)
        .join("");
}

export function snapshotRoot(entries: DrawTicketEntry[]): string {
    return sha256(canonicalList(entries)).toString("hex");
}

/**
 * Up to `count` distinct pids, each drawn by weight among the tickets not yet picked.
 * Sample k is `SHA-256(randomness ‖ gameId ‖ u64be(k))`, rejected above the largest multiple of the pool.
 */
export function rankCandidates(params: {
    randomness: string;
    gameId: string;
    entries: DrawTicketEntry[];
    count: number;
}): string[] {
    const seed = Buffer.from(params.randomness, "hex");
    const pool = canonicalEntries(params.entries);
    let total = BigInt(pool.reduce((sum, entry) => sum + entry.tickets, 0));
    const ranked: string[] = [];
    let k = 0n;

    while (ranked.length < params.count && pool.length > 0) {
        const limit = (TWO_POW_256 / total) * total;
        let sample: bigint;
        do {
            sample = BigInt(
                `0x${sha256(seed, params.gameId, u64be(k)).toString("hex")}`
            );
            k++;
        } while (sample >= limit);

        let index = sample % total;
        let picked = 0;
        while (index >= BigInt(pool[picked]?.tickets ?? 0)) {
            index -= BigInt(pool[picked]?.tickets ?? 0);
            picked++;
        }
        const [winner] = pool.splice(picked, 1);
        if (!winner) break;
        ranked.push(winner.pid);
        total -= BigInt(winner.tickets);
    }
    return ranked;
}
