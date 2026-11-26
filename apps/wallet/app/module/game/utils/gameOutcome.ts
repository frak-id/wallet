import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { GiftIcon, HourglassIcon } from "@frak-labs/design-system/icons";

/** Per outcome: the badge icon, what the ticket face shows, the headline key and the home card's link label. */
export const OUTCOME = {
    drawing: {
        badge: HourglassIcon,
        face: "tickets",
        title: "game.result.drawing.title",
        status: "game.card.statusDetails",
    },
    pending_verification: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.pendingVerification.title",
        status: "game.card.statusResult",
    },
    won: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.won.title",
        status: "game.card.statusResult",
    },
    lost: {
        badge: null,
        face: "tickets",
        title: "game.result.lost.title",
        status: "game.card.statusResult",
    },
    no_winner: {
        badge: null,
        face: "tickets",
        title: "game.result.noWinner.title",
        status: "game.card.statusResult",
    },
} as const satisfies Record<GameOutcome, unknown>;
