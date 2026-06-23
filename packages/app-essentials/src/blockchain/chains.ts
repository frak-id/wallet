import { isRunningInProd } from "../utils/env";

/**
 * Frak chain identifiers used across the stack.
 *
 * The libSQL `authenticator_wallet_bindings` table is shared across all
 * environments, so an authenticator registered on dev maps to the same wallet
 * address on prod (deterministic from passkey + factory). To keep the binding
 * table coherent regardless of deployment, every new authenticator is bound to
 * both chains at registration time and the bootstrap back-fill seeds both for
 * legacy rows.
 */

/** Arbitrum One. */
export const arbitrumChainId = 42161 as const;

/** Arbitrum Sepolia testnet. */
export const arbitrumSepoliaChainId = 421614 as const;

/**
 * Every chain id the platform recognises for authenticator ↔ wallet bindings.
 * Order is stable so iterating produces deterministic ouptut (mainnet first).
 */
export const frakChainIds = [arbitrumChainId, arbitrumSepoliaChainId] as const;

export type FrakChainId = (typeof frakChainIds)[number];

/**
 * The chain id matching the current deployment environment. Used by code
 * paths that must pick exactly one binding (e.g. `findByEmail` during the
 * email conflict check, since the lookup is naturally scoped to "my chain").
 */
export const currentChainId: FrakChainId = isRunningInProd
    ? arbitrumChainId
    : arbitrumSepoliaChainId;
