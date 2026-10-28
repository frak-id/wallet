import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type {
    InstagramGraphClient,
    InstagramProfileLookup,
} from "../../../infrastructure/integrations/instagram";
import type { InstagramLinkSelect } from "../db/schema";
import type { InstagramLinkCodeRepository } from "../repositories/InstagramLinkCodeRepository";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
import type { InstagramStatus } from "../schemas";
import {
    extractCodeCandidates,
    type IncomingInstagramMessage,
    isMockIgsid,
} from "../utils";
import type { InstagramLinkService } from "./InstagramLinkService";
import type { InstagramTokenService } from "./InstagramTokenService";

/** A player-triggered re-check hits Meta at most this often; `checked_at` holds across replicas. */
export const CHECK_COOLDOWN_MS = 30 * 1000;
const RECHECK_CONCURRENCY = 5;

/** Meta could not answer for reasons unrelated to the player: never read it as \"not following\". */
export class InstagramUnavailableError extends Error {
    constructor(reason: string) {
        super(`Instagram lookup unavailable: ${reason}`);
        this.name = "InstagramUnavailableError";
    }
}

export type MessageOutcome =
    | "linked"
    | "no_code"
    | "already_linked"
    | "profile_gone";

export class InstagramVerificationService {
    constructor(
        private readonly links: InstagramLinkRepository,
        private readonly codes: InstagramLinkCodeRepository,
        private readonly linkService: InstagramLinkService,
        private readonly tokens: Pick<InstagramTokenService, "current">,
        private readonly graph: Pick<InstagramGraphClient, "lookupProfile">
    ) {}

    /**
     * Links the sender to the account whose code the DM carries, then burns the code.
     * Throws `InstagramUnavailableError` so the webhook answers 500 and Meta redelivers.
     */
    async handleMessage({
        igsid,
        text,
    }: IncomingInstagramMessage): Promise<MessageOutcome> {
        const [code] = await this.codes.findByCodes(
            extractCodeCandidates(text)
        );
        if (!code) return "no_code";

        const lookup = await this.lookup(igsid);
        if (lookup.kind === "gone") return "profile_gone";
        try {
            await this.linkService.link({
                identityGroupId: code.identityGroupId,
                igsid,
                username: lookup.username,
                follows: lookup.follows,
            });
        } catch (error) {
            if (
                error instanceof HttpError &&
                error.code === "INSTAGRAM_ALREADY_LINKED"
            ) {
                log.info(
                    { identityGroupId: code.identityGroupId },
                    "Instagram code sent from an account linked to another wallet"
                );
                return "already_linked";
            }
            throw error;
        }
        await this.codes.deleteById(code.id);
        return "linked";
    }

    /** Re-reads the follow from Meta for the player; 502 `INSTAGRAM_UNAVAILABLE` when Meta cannot say. */
    async check(identityGroupId: string): Promise<InstagramStatus> {
        const link = await this.links.findByIdentityGroup(identityGroupId);
        if (link) {
            try {
                await this.refresh([link], CHECK_COOLDOWN_MS);
            } catch (error) {
                if (!(error instanceof InstagramUnavailableError)) throw error;
                throw HttpError.badGateway(
                    "INSTAGRAM_UNAVAILABLE",
                    "Instagram cannot be checked right now"
                );
            }
        }
        return this.linkService.status(identityGroupId);
    }

    /** Re-reads every certified link older than `maxAgeMs`; throws `InstagramUnavailableError` on any systemic failure. */
    async recheck(
        identityGroupIds: string[],
        { maxAgeMs }: { maxAgeMs: number }
    ): Promise<number> {
        const links = await this.links.findByIdentityGroups(identityGroupIds);
        return this.refresh(links, maxAgeMs);
    }

    private async refresh(
        links: InstagramLinkSelect[],
        maxAgeMs: number
    ): Promise<number> {
        const now = Date.now();
        const stale = links.filter(
            (link) =>
                !isMockIgsid(link.igsid) &&
                now - link.checkedAt.getTime() >= maxAgeMs
        );
        for (let i = 0; i < stale.length; i += RECHECK_CONCURRENCY) {
            await Promise.all(
                stale
                    .slice(i, i + RECHECK_CONCURRENCY)
                    .map((link) => this.refreshOne(link))
            );
        }
        return stale.length;
    }

    private async refreshOne(link: InstagramLinkSelect): Promise<void> {
        const lookup = await this.lookup(link.igsid);
        const follows = lookup.kind === "found" && lookup.follows;
        if (lookup.kind === "gone") {
            log.warn(
                { identityGroupId: link.identityGroupId, code: lookup.code },
                "Instagram no longer answers for a certified account: counted as not following"
            );
        }
        await this.links.refreshProfile(link.id, {
            username: lookup.kind === "found" ? lookup.username : link.username,
            follows,
            checkedAt: new Date(),
        });
        this.linkService.trackChange(link.follows, follows, link);
    }

    private async lookup(
        igsid: string
    ): Promise<Exclude<InstagramProfileLookup, { kind: "unavailable" }>> {
        const token = await this.tokens.current();
        if (!token) throw new InstagramUnavailableError("no access token");
        const lookup = await this.graph.lookupProfile(igsid, token);
        if (lookup.kind === "unavailable") {
            throw new InstagramUnavailableError("Meta did not answer");
        }
        return lookup;
    }
}
