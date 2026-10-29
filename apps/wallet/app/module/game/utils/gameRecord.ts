import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import { totalTickets } from "@/module/game/utils/ticketAmounts";

export type GameRecord =
    | { kind: "first"; mine: number }
    | { kind: "new"; mine: number; previous: number }
    | { kind: "held"; best: number; bestAt: Date | string };

const earned = (result: GameResult) => totalTickets(result.ticketsBySource);

/** How the tickets earned in `result` compare with the older games; `history` is latest first. */
export function recordOf(
    result: GameResult,
    history: GameResult[]
): GameRecord {
    const older = history.slice(
        history.findIndex((past) => past.game.id === result.game.id) + 1
    );
    const mine = earned(result);
    const [best] = older.sort((a, b) => earned(b) - earned(a));
    if (!best) return { kind: "first", mine };
    return earned(best) < mine
        ? { kind: "new", mine, previous: earned(best) }
        : { kind: "held", best: earned(best), bestAt: best.game.endsAt };
}
