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
        try {
            const saved = await this.repository.upsert({
                ...input,
                checkedAt: new Date(),
            });
            return toInstagramLink(saved);
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            throw HttpError.conflict(
                "INSTAGRAM_ALREADY_LINKED",
                "This Instagram account is linked to another wallet"
            );
        }
    }

    async unlink(identityGroupId: string): Promise<void> {
        await this.repository.deleteByIdentityGroup(identityGroupId);
    }
}
