import type {
    CurrentGameResponse,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";

/** How long after its end a game's result stays on the wallet home. */
const RESULT_CARD_MS = 14 * 24 * 60 * 60 * 1000;

export type HomeCard =
    | { kind: "drawn"; result: GameResult }
    | {
          kind: "open";
          game: NonNullable<CurrentGameResponse["game"]>;
          me: CurrentGameResponse["me"];
      }
    | { kind: "ended"; result: GameResult };

/** What the wallet home shows: a draw waiting on the user, else the open game, else a recent result. */
export function homeCardOf(
    current: CurrentGameResponse | undefined,
    history: GameResult[] | undefined,
    now = Date.now()
): HomeCard | null {
    const pending = history?.find(
        (result) => result.outcome === "pending_verification"
    );
    if (pending) return { kind: "drawn", result: pending };
    if (current?.game) {
        return { kind: "open", game: current.game, me: current.me };
    }
    const latest = current && history?.[0];
    if (!latest) return null;
    const recent =
        now - new Date(latest.game.endsAt).getTime() < RESULT_CARD_MS;
    return recent ? { kind: "ended", result: latest } : null;
}
