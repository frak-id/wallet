import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase64urlNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import type { BusinessAuthMethod, BusinessSessionSelect } from "../db/schema";
import type { BusinessSessionRepository } from "../repositories/BusinessSessionRepository";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const STEP_UP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Threshold below which a resolve refreshes the sliding expiry — touching the
 * row on every request would double the write load for no security benefit,
 * so the expiry is only pushed once at least a day of the window is consumed.
 */
const TOUCH_THRESHOLD_MS = SESSION_TTL_MS - 24 * 60 * 60 * 1000;

export type CreatedSession = {
    /** Raw bearer token — shown once, never stored. */
    token: string;
    session: BusinessSessionSelect;
};

/**
 * DB-backed session management per the Lucia guide: 32-byte random bearer
 * token, only its sha256 stored (as the row id), sliding 7-day expiry,
 * instant revocation, `two_factor_verified_at` as the single 2FA/step-up
 * freshness marker.
 */
export class BusinessSessionService {
    constructor(
        private readonly sessionRepository: BusinessSessionRepository
    ) {}

    /** sha256 of the raw token = session row id. Deterministic, unkeyed. */
    hashToken(token: string): string {
        return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
    }

    async create(params: {
        accountId: string;
        authMethod: BusinessAuthMethod;
        twoFactorVerified?: boolean;
        ip?: string;
        userAgent?: string;
    }): Promise<CreatedSession> {
        const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
        const token = encodeBase64urlNoPadding(tokenBytes);
        const session = await this.sessionRepository.create({
            id: this.hashToken(token),
            accountId: params.accountId,
            authMethod: params.authMethod,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            twoFactorVerifiedAt: params.twoFactorVerified
                ? new Date()
                : undefined,
            ip: params.ip,
            userAgent: params.userAgent,
        });
        return { token, session };
    }

    /**
     * Resolve a bearer token to its live session. Expired rows resolve to
     * null (and are deleted opportunistically); a resolve deep enough into
     * the window slides the expiry forward.
     */
    async resolve(token: string): Promise<BusinessSessionSelect | null> {
        const id = this.hashToken(token);
        const session = await this.sessionRepository.findById(id);
        if (!session) return null;

        if (session.expiresAt.getTime() <= Date.now()) {
            await this.sessionRepository.revoke(id);
            return null;
        }

        const remainingMs = session.expiresAt.getTime() - Date.now();
        if (remainingMs < TOUCH_THRESHOLD_MS) {
            const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
            await this.sessionRepository.touch(id, expiresAt);
            session.expiresAt = expiresAt;
        }

        return session;
    }

    /** Is the session's 2FA stamp fresh enough for a sensitive action? */
    isStepUpFresh(
        session: Pick<BusinessSessionSelect, "twoFactorVerifiedAt">,
        now = Date.now()
    ): boolean {
        if (!session.twoFactorVerifiedAt) return false;
        return now - session.twoFactorVerifiedAt.getTime() < STEP_UP_WINDOW_MS;
    }

    async markTwoFactorVerified(sessionId: string): Promise<void> {
        await this.sessionRepository.setTwoFactorVerified(
            sessionId,
            new Date()
        );
    }

    async revoke(sessionId: string): Promise<void> {
        await this.sessionRepository.revoke(sessionId);
    }
}
