import { rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { requireDbSession } from "./common";

export const sessionManagementRoutes = new Elysia()
    .use(
        rateLimitMiddleware({
            bucket: "business-auth-sessions",
            windowMs: 60_000,
            maxRequests: 30,
        })
    )
    .get(
        "/account",
        async ({ headers }) => {
            // The account's full credential set — which the session token alone
            // can't tell the client (a SIWE session that later added a password
            // still reports `authMethod: "siwe"`). Drives the settings
            // "linked credentials" view (add-X vs connected-as).
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });
            const account =
                await BusinessAuthContext.repositories.account.findById(
                    auth.accountId
                );
            return {
                email: account?.email ?? null,
                emailVerified: !!account?.emailVerifiedAt,
                hasPassword: !!account?.passwordHash,
                wallet: account?.walletAddress ?? null,
                hasShopify: !!account?.shopifyUserId,
            };
        },
        {
            response: {
                200: t.Object({
                    email: t.Nullable(t.String()),
                    emailVerified: t.Boolean(),
                    hasPassword: t.Boolean(),
                    wallet: t.Nullable(t.Address()),
                    hasShopify: t.Boolean(),
                }),
                401: t.ErrorResponse,
            },
        }
    )
    .post(
        "/logout",
        async ({ headers }) => {
            // Pending sessions can log out too (abandoning a 2FA flow).
            const auth = await requireDbSession(headers, {
                allowPending: true,
            });
            await BusinessAuthContext.services.session.revoke(auth.sessionId);
            return { loggedOut: true as const };
        },
        {
            response: {
                200: t.Object({ loggedOut: t.Literal(true) }),
                401: t.ErrorResponse,
            },
        }
    )
    .get(
        "/sessions",
        async ({ headers }) => {
            const auth = await requireDbSession(headers);
            const sessions =
                await BusinessAuthContext.repositories.session.findByAccount(
                    auth.accountId
                );
            return sessions.map((session) => ({
                id: session.id,
                authMethod: session.authMethod,
                current: session.id === auth.sessionId,
                createdAt: session.createdAt.getTime(),
                lastUsedAt: session.lastUsedAt.getTime(),
                expiresAt: session.expiresAt.getTime(),
                userAgent: session.userAgent,
            }));
        },
        {
            response: {
                200: t.Array(
                    t.Object({
                        id: t.String(),
                        authMethod: t.String(),
                        current: t.Boolean(),
                        createdAt: t.Number(),
                        lastUsedAt: t.Number(),
                        expiresAt: t.Number(),
                        userAgent: t.Nullable(t.String()),
                    })
                ),
                401: t.ErrorResponse,
            },
        }
    )
    .delete(
        "/sessions/:id",
        async ({ headers, params: { id } }) => {
            const auth = await requireDbSession(headers);
            // Scoped to the caller's account — cannot revoke someone else's.
            await BusinessAuthContext.repositories.session.revokeForAccount(
                id,
                auth.accountId
            );
            return { revoked: true as const };
        },
        {
            params: t.Object({ id: t.String() }),
            response: {
                200: t.Object({ revoked: t.Literal(true) }),
                401: t.ErrorResponse,
            },
        }
    );
