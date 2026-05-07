import type { Address } from "viem";

/**
 * Address utilities — minimal, dependency-free replacements for the subset of
 * `viem` helpers we used to import. Keeping these in-house lets the SDK ship
 * without pulling viem's checksum/keccak/error chain into the bundle.
 *
 * Scope is intentionally narrow:
 *  - `isAddress`: shape-only validation (no EIP-55 checksum)
 *  - `areAddressesEqual`: case-insensitive equality
 *  - `addressToBytes` / `bytesToAddress`: fixed 20-byte conversion
 */

/** Matches a 0x-prefixed 40-char hex string regardless of case. */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Check whether a value is a syntactically valid Ethereum address.
 *
 * This intentionally skips EIP-55 checksum validation: the SDK never produces
 * checksum-cased payloads, and downstream consumers (wallet, indexer) treat
 * addresses case-insensitively. Avoiding the checksum path drops keccak256 +
 * @noble/hashes from the bundle.
 */
export function isAddress(value: unknown): value is Address {
    return typeof value === "string" && ADDRESS_REGEX.test(value);
}

/**
 * Case-insensitive equality check for two Ethereum addresses.
 *
 * Both inputs are assumed to be syntactically valid addresses; callers that
 * receive untrusted input should validate via {@link isAddress} first.
 */
export function areAddressesEqual(a: Address, b: Address): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

/**
 * Decode a 20-byte Ethereum address into a fixed-size Uint8Array(20).
 *
 * Throws when the input is not exactly `0x` + 40 hex chars — callers wrap
 * the call in try/catch (see {@link FrakContextManager.compress}) so any
 * malformed input degrades to a graceful undefined return.
 */
export function addressToBytes(address: Address): Uint8Array {
    const bytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
        const byte = Number.parseInt(
            address.substring(2 + i * 2, 4 + i * 2),
            16
        );
        if (Number.isNaN(byte)) {
            throw new Error(`Invalid address: ${address}`);
        }
        bytes[i] = byte;
    }
    return bytes;
}

/** Lookup table avoids `padStart` overhead in the hot encode loop. */
const HEX_BYTE = /*#__PURE__*/ Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, "0")
);

/**
 * Encode a 20-byte Uint8Array (or a 20-byte subarray view) into a lowercase
 * hex Ethereum address. The caller MUST guarantee `bytes.length === 20`.
 */
export function bytesToAddress(bytes: Uint8Array): Address {
    let out = "0x";
    for (let i = 0; i < 20; i++) {
        out += HEX_BYTE[bytes[i]];
    }
    return out as Address;
}
