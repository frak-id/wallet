import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { GiftIcon, HourglassIcon } from "@frak-labs/design-system/icons";

/** Per outcome: the badge icon, what the ticket face shows, and the headline key. */
export const OUTCOME = {
    drawing: {
        badge: HourglassIcon,
        face: "tickets",
        title: "game.result.drawing.title",
    },
    pending_verification: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.pendingVerification.title",
    },
    won: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.won.title",
    },
    lost: {
        badge: null,
        face: "tickets",
        title: "game.result.lost.title",
    },
    no_winner: {
        badge: null,
        face: "tickets",
        title: "game.result.noWinner.title",
    },
} as const satisfies Record<GameOutcome, unknown>;
