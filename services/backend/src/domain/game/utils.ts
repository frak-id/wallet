import type { GameSelect } from "./db/schema";

export function isGameOpen(
    game: Pick<GameSelect, "status" | "startsAt" | "endsAt">,
    now: Date
): boolean {
    return (
        game.status === "active" && game.startsAt <= now && now < game.endsAt
    );
}

/** One join interaction per game per joining group. */
export function gameJoinExternalEventId(
    gameId: string,
    identityGroupId: string
): string {
    return `game_join:${gameId}:${identityGroupId}`;
}

/** One signup reward per referee, ever. */
export function signupExternalEventId(identityGroupId: string): string {
    return `signup:${identityGroupId}`;
}
