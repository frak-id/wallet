/**
 * Shared Wallet Testing Mocks
 *
 * This file provides common mocks for wallet-related dependencies used by both
 * the wallet app and wallet-shared package:
 *
 * - Wagmi hooks (useAccount, useConnect, useBalance, etc.)
 * - React Router hooks (useNavigate, useLocation, etc.) - via router-mocks.ts
 * - WebAuthn API (ox library)
 * - IndexedDB (idb-keyval)
 *
 * Projects using these mocks:
 * - apps/wallet
 * - packages/wallet-shared
 *
 * Note: These are global mocks. Tests can customize behavior using vi.mocked()
 * to override specific mock implementations for individual test cases.
 */

import { vi } from "vitest";
import { setupReactRouterMock } from "./router-mocks";

// Mock Wagmi hooks
vi.mock("wagmi", () => ({
    useAccount: vi.fn(() => ({
        address: "0x1234567890123456789012345678901234567890",
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: "connected",
    })),
    useConnect: vi.fn(() => ({
        connect: vi.fn(),
        connectors: [],
        error: null,
        isLoading: false,
        pendingConnector: null,
    })),
    useDisconnect: vi.fn(() => ({
        disconnect: vi.fn(),
    })),
    useBalance: vi.fn(() => ({
        data: {
            formatted: "1.0",
            symbol: "ETH",
            value: 1000000000000000000n,
            decimals: 18,
        },
        isLoading: false,
        error: null,
    })),
    useConfig: vi.fn(() => ({
        chains: [],
        transports: {},
    })),
}));

// Mock React Router (using shared router-mocks.ts abstraction)
await setupReactRouterMock();

// Mock ox WebAuthn API (migrated from @simplewebauthn)
vi.mock("ox", async () => {
    const actual = await vi.importActual<any>("ox");
    return {
        ...actual,
        WebAuthnP256: {
            sign: vi.fn(),
            createCredential: vi.fn(),
        },
    };
});

// Mock IndexedDB (idb-keyval)
vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    clear: vi.fn(),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    entries: vi.fn(() => []),
}));
