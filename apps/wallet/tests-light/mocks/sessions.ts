import type { Address, Hex } from "viem";

type MockSession = {
    token: string;
    type?: "webauthn";
    address: Address;
    publicKey: { x: Hex; y: Hex };
    authenticatorId: string;
    transports?: string[];
};

type SessionStoreState = {
    state: {
        session: MockSession | null;
        sdkSession: null;
        demoPrivateKey: null;
    };
    version: 0;
};

type UserStoreState = {
    state: {
        user: null;
        userSetupLater: null;
    };
    version: 0;
};

const mockAddress =
    "0x1234567890abcdef1234567890abcdef12345678" as const satisfies Address;

const authenticatedSession: MockSession = {
    token: "mock-jwt-token-for-light-playwright",
    type: "webauthn",
    address: mockAddress,
    publicKey: {
        x: "0x0000000000000000000000000000000000000000000000000000000000000001",
        y: "0x0000000000000000000000000000000000000000000000000000000000000002",
    },
    authenticatorId: "mock-authenticator-light",
    transports: ["internal"],
};

export const sessionStoreValue: SessionStoreState = {
    state: {
        session: authenticatedSession,
        sdkSession: null,
        demoPrivateKey: null,
    },
    version: 0,
};

export const userStoreValue: UserStoreState = {
    state: {
        user: null,
        userSetupLater: null,
    },
    version: 0,
};

export const unauthenticatedSessionStoreValue: SessionStoreState = {
    state: {
        session: null,
        sdkSession: null,
        demoPrivateKey: null,
    },
    version: 0,
};

export { mockAddress, type MockSession };
