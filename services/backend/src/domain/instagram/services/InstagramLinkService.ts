import { productEvents } from "@backend-infrastructure";
import { HttpError, isUniqueViolation } from "@backend-utils";
import type { InstagramDeclarationRepository } from "../repositories/InstagramDeclarationRepository";
import type { InstagramLinkCodeRepository } from "../repositories/InstagramLinkCodeRepository";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
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
        private readonly declarations: InstagramDeclarationRepository,
        private readonly codes: InstagramLinkCodeRepository
    ) {}

    async find(identityGroupId: string): Promise<InstagramLink | null> {
        const link = await this.repository.findByIdentityGroup(identityGroupId);
        return link && toInstagramLink(link);
    }

    async status(identityGroupId: string): Promise<InstagramStatus> {
        const [link, declaration] = await Promise.all([
            this.repository.findByIdentityGroup(identityGroupId),
            this.declarations.findByIdentityGroup(identityGroupId),
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
        const previous = await this.repository.findByIdentityGroup(
            input.identityGroupId
        );
        let saved: Awaited<ReturnType<InstagramLinkRepository["upsert"]>>;
        try {
            saved = await this.repository.upsert({
                ...input,
                checkedAt: new Date(),
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            throw HttpError.conflict(
                "INSTAGRAM_ALREADY_LINKED",
                "This Instagram account is linked to another wallet"
            );
        }
        await this.declarations.deleteByIdentityGroup(input.identityGroupId);
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
        const previous =
            await this.declarations.findByIdentityGroup(identityGroupId);
        const saved = await this.declarations.upsert({
            identityGroupId,
            username,
        });
        if (!previous) {
            productEvents.track("instagram_declared", identityGroupId, {});
        }
        return { link: null, declaration: toInstagramDeclaration(saved) };
    }

    async undeclare(identityGroupId: string): Promise<InstagramStatus> {
        await this.declarations.deleteByIdentityGroup(identityGroupId);
        return this.status(identityGroupId);
    }

    /** The same code until it is used, so one already copied keeps working. */
    async issueCode(identityGroupId: string): Promise<string> {
        const row = await this.codes.getOrCreate(identityGroupId);
        return row.code;
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
