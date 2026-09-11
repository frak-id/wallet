/**
 * Global mocks shared by `apps/wallet` and `packages/wallet-shared`: wagmi,
 * `@tanstack/react-router`, ox's WebAuthn and `idb-keyval`. Override a single
 * case with `vi.mocked()` rather than re-mocking the module.
 */

import { vi } from "vitest";
// Global @tanstack/react-router mock (top-level vi.mock side effect).
import "./tanstack-router-mock";

// Mock Wagmi hooks
vi.mock("wagmi", () => ({
    useConnection: vi.fn(() => ({
        address: "0x1234567890123456789012345678901234567890",
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: "connected",
    })),
    useAccount: vi.fn(() => ({
        address: "0x1234567890123456789012345678901234567890",
        isConnected: true,
        isConnecting: false,
        isDisconnected: false,
        isReconnecting: false,
        status: "connected",
    })),
    useConnect: vi.fn(() => ({
        mutate: vi.fn(),
        connect: vi.fn(),
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

// Mock ox WebAuthn API
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
    createStore: vi.fn(() => ({})),
}));
