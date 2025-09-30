/**
 * Built-in middleware for RPC listener
 *
 * This module provides commonly used middleware that can be composed
 * to add functionality to the RPC listener without modifying handlers.
 *
 * @module middleware
 */

export {
    createCompressionMiddleware,
    type CompressionMiddlewareConfig,
} from "./compression";

export {
    createLoggingMiddleware,
    type LoggingMiddlewareConfig,
} from "./logging";
