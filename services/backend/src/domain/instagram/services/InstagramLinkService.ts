import { productEvents } from "@backend-infrastructure";
import { HttpError, isUniqueViolation } from "@backend-utils";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
import type { InstagramLink } from "../schemas";
import { toInstagramLink } from "../utils";

export type LinkInstagramInput = {
    identityGroupId: string;
    igsid: string;
    username: string;
    follows: boolean;
};

export class InstagramLinkService {
    constructor(private readonly repository: InstagramLinkRepository) {}

    async find(identityGroupId: string): Promise<InstagramLink | null> {
        const link = await this.repository.findByIdentityGroup(identityGroupId);
        return link && toInstagramLink(link);
    }

    /** Stamps the follow state with now; 409 `INSTAGRAM_ALREADY_LINKED` when another identity holds the account. */
    async link(input: LinkInstagramInput): Promise<InstagramLink> {
        const previous = await this.repository.findByIdentityGroup(
            input.identityGroupId
        );
        try {
            const saved = await this.repository.upsert({
                ...input,
                checkedAt: new Date(),
            });
            this.trackChange(previous?.follows ?? null, saved.follows, input);
            return toInstagramLink(saved);
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            throw HttpError.conflict(
                "INSTAGRAM_ALREADY_LINKED",
                "This Instagram account is linked to another wallet"
            );
        }
    }

    /** `previousFollows` is null when the identity had no link before. */
    private trackChange(
        previousFollows: boolean | null,
        follows: boolean,
        { identityGroupId }: LinkInstagramInput
    ) {
        if (previousFollows === null) {
            productEvents.track("instagram_linked", identityGroupId, {
                follows,
            });
        }
        if (follows && !previousFollows) {
            productEvents.track(
                "instagram_follow_verified",
                identityGroupId,
                {}
            );
        }
    }

    async unlink(identityGroupId: string): Promise<void> {
        await this.repository.deleteByIdentityGroup(identityGroupId);
    }
}
