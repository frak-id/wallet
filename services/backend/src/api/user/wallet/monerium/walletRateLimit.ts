import { JwtContext, rateLimitMiddleware } from "@backend-infrastructure";
import { Elysia } from "elysia";

/** Plugin-level resolve: a macro-level one would run after the rate limiter. */
export const moneriumWalletContext = new Elysia({
    name: "Context.moneriumWallet",
})
    .resolve(async ({ headers }) => {
        const token = headers["x-wallet-auth"];
        const session = token ? await JwtContext.wallet.verify(token) : false;
        return { rateLimitWallet: session ? session.address : null };
    })
    .as("scoped");

/** `null` for an unauthenticated caller: the IP bucket and the 401 deal with it. */
export const walletRateLimitKey = (
    ctx: Record<string, unknown>
): string | null =>
    typeof ctx.rateLimitWallet === "string"
        ? `wallet:${ctx.rateLimitWallet.toLowerCase()}`
        : null;

/** Needs `moneriumWalletContext` registered before it. */
export function walletRateLimit(bucket: string, maxRequests: number) {
    return rateLimitMiddleware({
        bucket,
        windowMs: 60_000,
        maxRequests,
        keyExtractor: walletRateLimitKey,
    });
}
