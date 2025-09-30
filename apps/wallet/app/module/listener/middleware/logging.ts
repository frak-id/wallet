import type { WalletRpcContext } from "@/module/listener/types/context";
import { isRunningLocally } from "@frak-labs/app-essentials";
import type { RpcResponse } from "@frak-labs/rpc";

/**
 * Logging middleware for wallet RPC communication
 *
 * Logs RPC requests and responses for debugging purposes.
 * Only active in local development to avoid performance overhead in production.
 *
 * Performance:
 * - Zero overhead in production (early return)
 * - Minimal overhead in development (console.log is async)
 *
 * @example
 * ```ts
 * const listener = createRpcListener<IFrameRpcSchema, WalletRpcContext>({
 *   transport: window,
 *   allowedOrigins: '*',
 *   middleware: [
 *     compressionMiddleware,
 *     loggingMiddleware,  // Logs decompressed data
 *     walletContextMiddleware
 *   ]
 * })
 * ```
 */
export const loggingMiddleware = {
    onRequest: <TContext extends WalletRpcContext>(
        message: unknown,
        context: TContext
    ): TContext => {
        const msg = message as { id: string; topic: string; data: unknown };
        const ctx = context as { origin: string };
        // Only log in local development
        if (!isRunningLocally) {
            return context;
        }

        console.log("[Wallet RPC] Request:", {
            topic: msg.topic,
            origin: ctx.origin,
            id: msg.id,
            // Don't log full data to avoid noise
            hasData: !!msg.data,
        });

        return context;
    },

    onResponse: <TContext extends WalletRpcContext>(
        message: unknown,
        response: RpcResponse,
        context: TContext
    ): RpcResponse => {
        const msg = message as { id: string; topic: string };
        const ctx = context as { origin: string };
        // Only log in local development
        if (!isRunningLocally) {
            return response;
        }

        if (response.error) {
            console.error("[Wallet RPC] Error response:", {
                topic: msg.topic,
                origin: ctx.origin,
                id: msg.id,
                error: response.error,
            });
        } else {
            console.log("[Wallet RPC] Success response:", {
                topic: msg.topic,
                origin: ctx.origin,
                id: msg.id,
                // Don't log full result to avoid noise
                hasResult: !!response.result,
            });
        }

        return response;
    },
} as const;
