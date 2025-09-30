import type { RpcSchema } from "../rpc-schema";
import type { RpcMiddleware } from "../types";

/**
 * Logging middleware configuration
 */
export type LoggingMiddlewareConfig = {
    /**
     * Log level for requests
     * @default "info"
     */
    logLevel?: "debug" | "info" | "warn" | "error";
    /**
     * Whether to log request parameters
     * @default false (for security/privacy)
     */
    logParams?: boolean;
    /**
     * Whether to log response data
     * @default false (for security/privacy)
     */
    logResponse?: boolean;
    /**
     * Custom prefix for log messages
     * @default "[RPC]"
     */
    prefix?: string;
};

/**
 * Creates a logging middleware for RPC requests
 * Logs request and response information for debugging and monitoring
 *
 * @param config - Logging configuration
 * @returns Logging middleware instance
 *
 * @example
 * ```ts
 * const listener = createRpcListener({
 *   transport: window,
 *   allowedOrigins: ['https://example.com'],
 *   middleware: [
 *     createLoggingMiddleware({
 *       logLevel: 'info',
 *       logParams: true,
 *       prefix: '[Wallet RPC]'
 *     })
 *   ]
 * })
 * ```
 */
export function createLoggingMiddleware<TSchema extends RpcSchema>(
    config: LoggingMiddlewareConfig = {}
): RpcMiddleware<TSchema> {
    const {
        logLevel = "info",
        logParams = false,
        logResponse = false,
        prefix = "[RPC]",
    } = config;

    const logger =
        console[logLevel]?.bind(console) ?? console.log.bind(console);

    return {
        onRequest: (message, context) => {
            const logData: unknown[] = [
                prefix,
                "Request:",
                message.topic,
                `from ${context.origin}`,
                `[id: ${message.id}]`,
            ];

            if (logParams) {
                logData.push("\nParams:", message.data);
            }

            logger(...logData);

            return context;
        },

        onResponse: (message, response, context) => {
            const logData: unknown[] = [
                prefix,
                "Response:",
                message.topic,
                `to ${context.origin}`,
                `[id: ${message.id}]`,
            ];

            if (response.error) {
                logData.push(
                    `\nError: [${response.error.code}] ${response.error.message}`
                );
            } else if (logResponse) {
                logData.push("\nResult:", response.result);
            }

            logger(...logData);

            return response;
        },
    };
}
