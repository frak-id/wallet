import { Elysia, status } from "elysia";
import type { Address } from "viem";
import type { StaticWalletTokenDto } from "../../domain/auth/models/WalletSessionDto";
import { OrchestrationContext } from "../../orchestration/context";
import { JwtContext } from "../external/jwt";

/**
 * Wallet session + identity-group resolver. Mirrors `sessionContext` but also
 * resolves `identityGroupId` so handlers and rate-limit extractors can key on
 * the caller's identity group without a follow-up DB call per route.
 *
 * Plugin-level `.resolve()` runs before `onBeforeHandle`, which means a
 * `rateLimitMiddleware` using a `keyExtractor` can read `identityGroupId`
 * during rate-limit evaluation. Macro-level resolve runs too late for that,
 * hence the plugin-level placement.
 *
 * `identityGroupId` is `null` when no wallet session is present on the request;
 * opt into the `withAuthedIdentity` macro to reject unauthenticated callers
 * with `401` automatically.
 *
 * Identity resolution is idempotent and cached (`IdentityRepository` uses an
 * LRU), so the plugin-level resolve is cheap for returning users.
 */
export const identityContext = new Elysia({ name: "Context.identity" })
    .resolve(
        async ({
            headers,
        }): Promise<{
            walletSession: StaticWalletTokenDto | null;
            identityGroupId: string | null;
        }> => {
            const walletAuth = headers["x-wallet-auth"];
            if (!walletAuth) {
                return { walletSession: null, identityGroupId: null };
            }

            const session = await JwtContext.wallet.verify(walletAuth);
            if (!session) {
                return { walletSession: null, identityGroupId: null };
            }

            const { groupId } =
                await OrchestrationContext.orchestrators.identity.resolve({
                    type: "wallet",
                    value: session.address as Address,
                });

            return { walletSession: session, identityGroupId: groupId };
        }
    )
    .macro({
        withAuthedIdentity(enabled?: boolean) {
            if (!enabled) return;
            return {
                // biome-ignore lint/suspicious/noExplicitAny: Elysia's macro type system does not yet carry plugin-resolved values through macro contexts.
                beforeHandle: (ctx: any) => {
                    if (!ctx.walletSession || !ctx.identityGroupId) {
                        return status(401, "Unauthorized");
                    }
                },
            };
        },
    })
    .as("scoped");
