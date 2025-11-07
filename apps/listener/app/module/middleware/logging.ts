import { isRunningLocally } from "@frak-labs/app-essentials";
import type {
    RpcMiddleware,
    RpcMiddlewareContext,
    RpcResponse,
} from "@frak-labs/frame-connector";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/types/context";

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
export const loggingMiddleware: RpcMiddleware<
    CombinedRpcSchema,
    WalletRpcContext
> = {
    onRequest: (message, context): RpcMiddlewareContext<WalletRpcContext> => {
        const msg = message as { id: string; topic: string; data: unknown };
        // Only log in local development
        if (!isRunningLocally) {
            return context;
        }

        console.log("[Wallet RPC] Request:", {
            topic: msg.topic,
            origin: context.origin,
            id: msg.id,
            // Don't log full data to avoid noise
            hasData: msg.data,
        });

        return context;
    },

    onResponse: (message, response, _context): RpcResponse => {
        const msg = message as { id: string; topic: string };
        // Only log in local development
        if (!isRunningLocally) {
            return response;
        }

        if (response.error) {
            console.error("[Wallet RPC] Error response:", {
                topic: msg.topic,
                origin: _context.origin,
                id: msg.id,
                error: response.error,
            });
        } else {
            console.log("[Wallet RPC] Success response:", {
                topic: msg.topic,
                origin: _context.origin,
                id: msg.id,
                // Don't log full result to avoid noise
                hasResult: response.result,
            });
        }

        return response;
    },
};
