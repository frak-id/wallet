import { productEvents } from "@backend-infrastructure";
import { HttpError, isUniqueViolation } from "@backend-utils";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
import type { InstagramPendingLinkRepository } from "../repositories/InstagramPendingLinkRepository";
import type { InstagramLink, InstagramStatus } from "../schemas";
import {
    normalizeInstagramHandle,
    toInstagramDeclaration,
    toInstagramLink,
} from "../utils";

export type LinkInstagramInput = {
    identityGroupId: string;
    igsid: string;
    username: string;
    follows: boolean;
};

export class InstagramLinkService {
    constructor(
        private readonly repository: InstagramLinkRepository,
        private readonly pending: InstagramPendingLinkRepository
    ) {}

    async find(identityGroupId: string): Promise<InstagramLink | null> {
        const link = await this.repository.findByIdentityGroup(identityGroupId);
        return link && toInstagramLink(link);
    }

    async status(identityGroupId: string): Promise<InstagramStatus> {
        const [link, declaration] = await Promise.all([
            this.repository.findByIdentityGroup(identityGroupId),
            this.pending.findDeclaration(identityGroupId),
        ]);
        return {
            link: link && toInstagramLink(link),
            declaration: link
                ? null
                : declaration && toInstagramDeclaration(declaration),
        };
    }

    /** Certifies: stamps the follow state with now and replaces any declaration. 409 `INSTAGRAM_ALREADY_LINKED` when another identity holds the account. */
    async link(input: LinkInstagramInput): Promise<InstagramLink> {
        const saved = await this.certify(input);
        if (!saved) throw new Error("Certifying without a code claims nothing");
        return saved;
    }

    /** {@link link}, consuming the DM code in the same transaction; null when the code was already used or dropped by a merge. */
    linkWithCode(
        code: string,
        input: LinkInstagramInput
    ): Promise<InstagramLink | null> {
        return this.certify(input, code);
    }

    private async certify(
        input: LinkInstagramInput,
        code?: string
    ): Promise<InstagramLink | null> {
        const previous = await this.repository.findByIdentityGroup(
            input.identityGroupId
        );
        let saved: Awaited<ReturnType<InstagramLinkRepository["certify"]>>;
        try {
            saved = await this.repository.certify(
                { ...input, checkedAt: new Date() },
                code
            );
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            throw HttpError.conflict(
                "INSTAGRAM_ALREADY_LINKED",
                "This Instagram account is linked to another wallet"
            );
        }
        if (!saved) return null;
        this.trackChange(previous?.follows ?? null, saved.follows, input);
        return toInstagramLink(saved);
    }

    /** 409 `INSTAGRAM_ALREADY_CERTIFIED`: a declaration would only hide the certified account. */
    async declare(
        identityGroupId: string,
        rawUsername: string
    ): Promise<InstagramStatus> {
        const username = normalizeInstagramHandle(rawUsername);
        if (!username) {
            throw HttpError.badRequest(
                "INVALID_INSTAGRAM_HANDLE",
                "Not a valid Instagram handle"
            );
        }
        if (await this.repository.findByIdentityGroup(identityGroupId)) {
            throw HttpError.conflict(
                "INSTAGRAM_ALREADY_CERTIFIED",
                "This wallet already certified an Instagram account"
            );
        }
        const previous = await this.pending.findDeclaration(identityGroupId);
        const saved = await this.pending.declare({
            identityGroupId,
            username,
        });
        if (!previous) {
            productEvents.track("instagram_declared", identityGroupId, {});
        }
        return { link: null, declaration: toInstagramDeclaration(saved) };
    }

    async undeclare(identityGroupId: string): Promise<InstagramStatus> {
        await this.pending.undeclare(identityGroupId);
        return this.status(identityGroupId);
    }

    /** The same code until it is used, so one already copied keeps working. */
    issueCode(identityGroupId: string): Promise<string> {
        return this.pending.getOrCreateCode(identityGroupId);
    }

    /** `previousFollows` is null when the identity had no link before. */
    trackChange(
        previousFollows: boolean | null,
        follows: boolean,
        { identityGroupId }: Pick<LinkInstagramInput, "identityGroupId">
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
