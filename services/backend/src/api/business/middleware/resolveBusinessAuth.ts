import { JwtContext } from "@backend-infrastructure";
import type { Address } from "viem";
import {
    BusinessAuthContext,
    type BusinessAuthMethod,
} from "../../../domain/business-auth";

/**
 * Unified view over the two `x-business-auth` token generations:
 *  - Opaque DB-session token (no dots) — the target model.
 *  - Legacy business JWT (contains dots) — 7-day grace path, deleted in
 *    Phase 4. Legacy sessions have no account/session row: `accountId` and
 *    `sessionId` are null, and step-up can only be satisfied by a fresh
 *    SIWE login (which mints a DB session).
 */
export type ResolvedBusinessAuth = {
    accountId: string | null;
    sessionId: string | null;
    wallet: Address | null;
    authMethod: BusinessAuthMethod;
    twoFactorVerifiedAt: Date | null;
    /** DB session minted but 2FA not yet verified — unusable outside /auth. */
    pending2fa: boolean;
};

export async function resolveBusinessAuth(
    token: string
): Promise<ResolvedBusinessAuth | null> {
    // Legacy JWT grace path: JWTs are dot-separated, opaque tokens are
    // base64url (dot-free).
    if (token.includes(".")) {
        const legacy = await JwtContext.business.verify(token);
        if (!legacy) return null;
        return {
            accountId: null,
            sessionId: null,
            wallet: legacy.wallet,
            authMethod: "siwe",
            twoFactorVerifiedAt: null,
            pending2fa: false,
        };
    }

    const session = await BusinessAuthContext.services.session.resolve(token);
    if (!session) return null;

    const account = await BusinessAuthContext.repositories.account.findById(
        session.accountId
    );

    return {
        accountId: session.accountId,
        sessionId: session.id,
        wallet: account?.walletAddress ?? null,
        authMethod: session.authMethod,
        twoFactorVerifiedAt: session.twoFactorVerifiedAt,
        // Shopify SSO is the login factor on its own: the session is usable
        // (dashboard + merchant access) immediately, without a login-time 2FA
        // step. It is deliberately never step-up-fresh though —
        // `twoFactorVerifiedAt` stays null, so sensitive actions still gate on
        // a real step-up (§4.8). Password/SIWE keep the pending-until-2FA flow.
        pending2fa:
            session.twoFactorVerifiedAt === null &&
            session.authMethod !== "shopify",
    };
}
