import type { DropSelect } from "../../domain/game/db/schema";
import type { DropRepository } from "../../domain/game/repositories/DropRepository";
import type {
    CurrentDropResponse,
    DropSummary,
} from "../../domain/game/schemas";
import { dropJoinExternalEventId } from "../../domain/game/utils";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import { interactionTypes } from "../../domain/rewards/schemas";

export class FrakGameOrchestrator {
    constructor(
        private readonly dropRepository: DropRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async getCurrentDrop(
        identityGroupId: string
    ): Promise<CurrentDropResponse> {
        const drop = await this.dropRepository.findCurrent(new Date());
        if (!drop) return { drop: null };

        const [summary, joined] = await Promise.all([
            this.summarize(drop),
            this.interactionLogRepository.existsByExternalEvent({
                merchantId: FRAK_MERCHANT_ID,
                type: interactionTypes.dropJoin,
                externalEventId: dropJoinExternalEventId(
                    drop.id,
                    identityGroupId
                ),
            }),
        ]);
        return { drop: { ...summary, joined } };
    }

    async summarize(drop: DropSelect): Promise<DropSummary> {
        const sponsor = drop.sponsorMerchantId
            ? await this.merchantRepository.findById(drop.sponsorMerchantId)
            : null;
        return {
            id: drop.id,
            prizeDescription: drop.prizeDescription,
            startsAt: drop.startsAt,
            endsAt: drop.endsAt,
            sponsor: sponsor
                ? { id: sponsor.id, name: sponsor.name, domain: sponsor.domain }
                : null,
        };
    }
}
