import {
    CODE_LENGTH,
    generateCandidates,
    HttpError,
    STEM_ALPHABET,
} from "@backend-utils";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import type { GameRepository } from "../../domain/game/repositories/GameRepository";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { FRAK_REFERRAL_IDENTITY_GROUP_ID } from "../../domain/referral-code/constants";
import type { ReferralCodeSelect } from "../../domain/referral-code/db/schema";
import type { ReferralCodeRepository } from "../../domain/referral-code/repositories/ReferralCodeRepository";
import type { FrakCode } from "../schemas/internalSchemas";

/** 400 `INVALID_CODE` unless `raw` is a 6-character code from the stem alphabet. */
export function parseVanityCode(raw: string): string {
    const code = raw.trim().toUpperCase();
    if (code.length !== CODE_LENGTH) {
        throw HttpError.badRequest(
            "INVALID_CODE",
            `A code is exactly ${CODE_LENGTH} characters`
        );
    }
    const invalid = [...code].find((ch) => !STEM_ALPHABET.includes(ch));
    if (invalid) {
        throw HttpError.badRequest(
            "INVALID_CODE",
            `A code cannot contain "${invalid}"`
        );
    }
    return code;
}

/** Frak's own referral codes: issued by hand, joined to a game when one is opened on them. */
export class FrakCodeAdminOrchestrator {
    constructor(
        private readonly referralCodes: Pick<
            ReferralCodeRepository,
            "createFrakCode" | "revokeFrakCode" | "listFrakCodes"
        >,
        private readonly referralLinks: Pick<
            ReferralLinkRepository,
            "countByCodeIds"
        >,
        private readonly games: Pick<GameRepository, "list">,
        private readonly identities: Pick<IdentityRepository, "ensureGroup">
    ) {}

    async list(): Promise<FrakCode[]> {
        const codes = await this.referralCodes.listFrakCodes();
        const [counts, games] = await Promise.all([
            this.referralLinks.countByCodeIds(codes.map((c) => c.id)),
            this.games.list(),
        ]);
        const gameOf = new Map(games.map((g) => [g.referralCodeId, g.id]));
        return codes.map((code) => ({
            id: code.id,
            code: code.code,
            createdAt: code.createdAt,
            revokedAt: code.revokedAt,
            redemptions: counts.get(code.id)?.total ?? 0,
            activeReferees: counts.get(code.id)?.active ?? 0,
            gameId: gameOf.get(code.id) ?? null,
        }));
    }

    /** A vanity code when `raw` is given, a random one otherwise; 409 `CODE_TAKEN` when the vanity code is active. */
    async issue(raw?: string): Promise<ReferralCodeSelect> {
        const candidates = raw ? [parseVanityCode(raw)] : generateCandidates();
        await this.identities.ensureGroup(FRAK_REFERRAL_IDENTITY_GROUP_ID);
        for (const candidate of candidates) {
            const created = await this.referralCodes.createFrakCode(candidate);
            if (created) return created;
        }
        throw raw
            ? HttpError.conflict(
                  "CODE_TAKEN",
                  `${candidates[0]} is already in use`
              )
            : HttpError.conflict("NO_FREE_CODE", "No free code, try again");
    }

    /** Stops new redemptions; referees keep Frak as their referrer. */
    async revoke(code: string): Promise<ReferralCodeSelect> {
        const revoked = await this.referralCodes.revokeFrakCode(code);
        if (!revoked) {
            throw HttpError.notFound(
                "CODE_NOT_FOUND",
                `No active Frak code ${code.toUpperCase()}`
            );
        }
        return revoked;
    }
}
