import type { GameSelect } from "../../domain/game/db/schema";
import type { GameSummary } from "../../domain/game/schemas";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";

export async function summarizeGame(
    game: GameSelect,
    merchants: Pick<MerchantRepository, "findById">
): Promise<GameSummary> {
    const sponsor = game.sponsorMerchantId
        ? await merchants.findById(game.sponsorMerchantId)
        : null;
    return {
        id: game.id,
        prizeAmount: game.prizeAmount,
        prizeDescription: game.prizeDescription,
        startsAt: game.startsAt,
        endsAt: game.endsAt,
        sponsor: sponsor && {
            id: sponsor.id,
            name: sponsor.name,
            domain: sponsor.domain,
            logoUrl: sponsor.explorerConfig?.logoUrl,
        },
    };
}
