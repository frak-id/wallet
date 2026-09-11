import type { Address, Hex } from "viem";
import type {
    DistantWebAuthnWallet,
    EcdsaWallet,
    SdkSession,
} from "../types/Session";
import type { WebAuthNWallet } from "../types/WebAuthN";

/**
 * Test factory functions for creating mock objects with sensible defaults.
 * All factories support partial overrides for customization.
 */

/** `seed` varies the address; it is right-padded with zeros to 20 bytes. */
export function createMockAddress(seed = "1234"): Address {
    return `0x${seed.padEnd(40, "0")}` as Address;
}

export function createMockSession(
    overrides?: Partial<Omit<WebAuthNWallet & { token: string }, "type">>
): WebAuthNWallet & { token: string } {
    return {
        type: "webauthn",
        address: createMockAddress(),
        publicKey: {
            x: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            y: "0xabcdef1234567890123456789012345678901234567890123456789012345678" as Hex,
        },
        authenticatorId: "auth-123",
        token: "test-token",
        ...overrides,
    };
}

export function createMockEcdsaSession(
    overrides?: Partial<Omit<EcdsaWallet & { token: string }, "type">>
): EcdsaWallet & { token: string } {
    return {
        type: "ecdsa",
        address: createMockAddress(),
        publicKey: "0x123456" as Hex,
        authenticatorId: "ecdsa-123",
        token: "test-token",
        transports: undefined,
        ...overrides,
    };
}

export function createMockDistantWebAuthNSession(
    overrides?: Partial<Omit<DistantWebAuthnWallet & { token: string }, "type">>
): DistantWebAuthnWallet & { token: string } {
    return {
        type: "distant-webauthn",
        address: createMockAddress(),
        publicKey: {
            x: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            y: "0xabcdef1234567890123456789012345678901234567890123456789012345678" as Hex,
        },
        authenticatorId: "auth-123",
        pairingId: "pairing-123",
        token: "test-token",
        transports: undefined,
        ...overrides,
    };
}

export function createMockSdkSession(
    overrides?: Partial<SdkSession>
): SdkSession {
    return {
        token: "sdk-token",
        expires: Date.now() + 3600000, // 1 hour from now
        ...overrides,
    };
}

export function createMockClient(chainId = 1): {
    chain: { id: number };
    account: undefined;
    transport: object;
} {
    return {
        chain: { id: chainId },
        account: undefined,
        transport: {},
    };
}
