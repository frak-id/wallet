import type { Address } from "viem";
import type { NotificationModel } from "../common/storage/NotificationModel";
import type { InteractionSession, SdkSession, Session } from "../types/Session";

/**
 * Test factory functions for creating mock objects with sensible defaults.
 * All factories support partial overrides for customization.
 */

/**
 * Creates a mock Ethereum address
 * @param seed - Optional seed for generating different addresses
 */
export function createMockAddress(seed = "1234"): Address {
    return `0x${seed.padEnd(40, "0")}` as Address;
}

/**
 * Creates a mock WebAuthN session with default values
 */
export function createMockSession(overrides?: Partial<Session>): Session {
    return {
        type: "webauthn",
        address: createMockAddress(),
        publicKey: {
            x: "0x1234567890123456789012345678901234567890123456789012345678901234" as `0x${string}`,
            y: "0xabcdef1234567890123456789012345678901234567890123456789012345678" as `0x${string}`,
        },
        authenticatorId: "auth-123",
        token: "test-token",
        ...overrides,
    } as Session;
}

/**
 * Creates a mock ECDSA session with default values
 */
export function createMockEcdsaSession(
    overrides?: Partial<Omit<Session, "type">>
): Session {
    return {
        type: "ecdsa",
        address: createMockAddress(),
        publicKey: "0x123456" as Address,
        authenticatorId: "ecdsa-123",
        token: "test-token",
        transports: undefined,
        ...overrides,
    } as Session;
}

/**
 * Creates a mock Distant WebAuthN session with default values
 */
export function createMockDistantWebAuthNSession(
    overrides?: Partial<Omit<Session, "type">>
): Session {
    return {
        type: "distant-webauthn",
        address: createMockAddress(),
        publicKey: {
            x: "0x1234567890123456789012345678901234567890123456789012345678901234" as `0x${string}`,
            y: "0xabcdef1234567890123456789012345678901234567890123456789012345678" as `0x${string}`,
        },
        authenticatorId: "auth-123",
        pairingId: "pairing-123",
        token: "test-token",
        transports: undefined,
        ...overrides,
    } as Session;
}

/**
 * Creates a mock WebAuthN wallet with default values
 */
export function createMockWebAuthNWallet(
    overrides?: Partial<Omit<Session, "type">>
): Session {
    return {
        type: "webauthn",
        address: createMockAddress(),
        publicKey: {
            x: "0xabc" as `0x${string}`,
            y: "0xdef" as `0x${string}`,
        },
        authenticatorId: "auth-id",
        token: "wallet-token",
        ...overrides,
    } as Session;
}

/**
 * Creates a mock SDK session with default values
 */
export function createMockSdkSession(
    overrides?: Partial<SdkSession>
): SdkSession {
    return {
        token: "sdk-token",
        expires: Date.now() + 3600000, // 1 hour from now
        ...overrides,
    };
}

/**
 * Creates a mock interaction session with default values
 */
export function createMockInteractionSession(
    overrides?: Partial<InteractionSession>
): InteractionSession {
    return {
        sessionStart: Date.now(),
        sessionEnd: Date.now() + 3600000, // 1 hour from now
        ...overrides,
    };
}

/**
 * Creates a mock notification with default values
 */
export function createMockNotification(
    overrides?: Partial<NotificationModel>
): NotificationModel {
    return {
        id: `notif-${Date.now()}`,
        title: "Test Notification",
        body: "Test notification body",
        timestamp: Date.now(),
        ...overrides,
    };
}

/**
 * Creates a mock Viem client for testing
 */
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
