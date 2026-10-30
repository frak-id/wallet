import type { GameSummary } from "@frak-labs/backend-elysia/domain/game/schemas";
import type { TFunction } from "i18next";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";

type Prize = Pick<GameSummary, "prizeAmount" | "prizeDescription">;

/** The prize as the game words it, else its amount. */
export function prizeOf(game: Prize, locale: string): string {
    return game.prizeDescription ?? formatGameAmount(game.prizeAmount, locale);
}

/** A bare amount reads "50 € to win in the draw"; a description already says what it is. */
export function prizeToWinOf(t: TFunction, game: Prize, locale: string) {
    return (
        game.prizeDescription ??
        t("game.prizeToWin", {
            prize: formatGameAmount(game.prizeAmount, locale),
        })
    );
}
