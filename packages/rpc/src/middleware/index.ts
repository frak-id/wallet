/**
 * Built-in middleware for RPC communication
 *
 * This module provides commonly used middleware that can be composed
 * to add functionality to both RPC client and listener.
 *
 * @module middleware
 */

export {
    createClientCompressionMiddleware,
    createListenerCompressionMiddleware,
} from "./compression";
