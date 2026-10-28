import { log } from "@backend-infrastructure";
import { sha256Hex } from "@backend-utils";
import type { InstagramGraphClient } from "../../../infrastructure/integrations/instagram";
import { readInstagramConfig } from "../config";
import type { InstagramAccessTokenRepository } from "../repositories/InstagramAccessTokenRepository";
import type { InstagramTokenCipher } from "./InstagramTokenCipher";

/** One connected account per environment (FRA-372). */
const ACCOUNT = "frak";
/** Well inside the 60-day lifetime, so a few failed renewals still leave weeks to react. */
export const TOKEN_REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
/** A renewal failing this close to expiry is an incident, not a retry. */
const EXPIRY_ALERT_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type TokenRefreshOutcome = "refreshed" | "fresh" | "none" | "failed";

export class InstagramTokenService {
    private cached: { token: string; until: number } | null = null;

    constructor(
        private readonly repository: InstagramAccessTokenRepository,
        private readonly cipher: InstagramTokenCipher,
        private readonly graph: Pick<InstagramGraphClient, "refreshToken">
    ) {}

    /** `null` when certification is not configured. A new env token replaces the stored one. */
    async current(): Promise<string | null> {
        if (this.cached && this.cached.until > Date.now()) {
            return this.cached.token;
        }
        const seed = readInstagramConfig()?.seedAccessToken;
        if (!seed) return null;

        const row = await this.repository.find(ACCOUNT);
        const seedHash = sha256Hex(seed);
        let token: string;
        if (row?.seedHash === seedHash) {
            token = await this.cipher.decrypt(row.tokenEncrypted, ACCOUNT);
        } else {
            await this.repository.save({
                account: ACCOUNT,
                tokenEncrypted: await this.cipher.encrypt(seed, ACCOUNT),
                seedHash,
                refreshedAt: new Date(),
                expiresAt: null,
            });
            token = seed;
        }
        this.cached = { token, until: Date.now() + CACHE_TTL_MS };
        return token;
    }

    /** Renews the stored token once it is a week old; the cron's whole job. */
    async refreshIfDue(now = new Date()): Promise<TokenRefreshOutcome> {
        if (!(await this.current())) return "none";
        const row = await this.repository.find(ACCOUNT);
        if (!row) return "none";
        if (
            now.getTime() - row.refreshedAt.getTime() <
            TOKEN_REFRESH_EVERY_MS
        ) {
            return "fresh";
        }

        const token = await this.cipher.decrypt(row.tokenEncrypted, ACCOUNT);
        const renewed = await this.graph.refreshToken(token);
        if (!renewed) {
            if (
                row.expiresAt &&
                row.expiresAt.getTime() - now.getTime() < EXPIRY_ALERT_MS
            ) {
                log.error(
                    { expiresAt: row.expiresAt },
                    "Instagram token expires soon and cannot be renewed: reconnect @frak_fr and update INSTAGRAM_ACCESS_TOKEN"
                );
            }
            return "failed";
        }
        await this.repository.save({
            account: ACCOUNT,
            tokenEncrypted: await this.cipher.encrypt(renewed.token, ACCOUNT),
            seedHash: row.seedHash,
            refreshedAt: now,
            expiresAt: new Date(
                now.getTime() + renewed.expiresInSeconds * 1000
            ),
        });
        this.cached = null;
        return "refreshed";
    }
}
