/**
 * Wallet RPC middleware
 *
 * Middleware stack for processing RPC requests in the wallet listener.
 * Middleware executes in the order specified in the listener configuration.
 *
 * Recommended order:
 * 1. compressionMiddleware - Decompress incoming data first
 * 2. loggingMiddleware - Log decompressed data (development only)
 * 3. walletContextMiddleware - Augment context with wallet-specific fields
 */

export { compressionMiddleware } from "./compression";
export { loggingMiddleware } from "./logging";
export { walletContextMiddleware } from "./walletContext";
