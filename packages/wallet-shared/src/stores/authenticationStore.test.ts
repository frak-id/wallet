import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../tests/vitest-fixtures";
import type { Session } from "../types/Session";
import {
    addLastAuthentication,
    authenticationStore,
    selectCurrentSsoMetadata,
    selectLastAuthenticator,
    selectLastWebAuthNAction,
    selectSsoContext,
} from "./authenticationStore";
import type {
    AuthenticationResponseJSON,
    LastAuthentication,
    LastWebAuthNAction,
} from "./types";

// Mock the authenticator storage
vi.mock("../common/storage/authenticators", () => ({
    authenticatorStorage: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
    },
}));

describe("authenticationStore", () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        authenticationStore.getState().clearAuthentication();
        vi.clearAllMocks();
    });

    describe("initial state", () => {
        test("should have correct initial values", () => {
            const state = authenticationStore.getState();

            expect(state.lastAuthenticator).toBeNull();
            expect(state.lastWebAuthNAction).toBeNull();
            expect(state.ssoContext).toBeNull();
        });
    });

    describe("setLastAuthenticator", () => {
        test("should set last authenticator", () => {
            const mockAuthenticator: LastAuthentication = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            };

            authenticationStore
                .getState()
                .setLastAuthenticator(mockAuthenticator);
            expect(authenticationStore.getState().lastAuthenticator).toEqual(
                mockAuthenticator
            );
        });

        test("should clear last authenticator when null", () => {
            const mockAuthenticator: LastAuthentication = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            };

            authenticationStore
                .getState()
                .setLastAuthenticator(mockAuthenticator);
            authenticationStore.getState().setLastAuthenticator(null);
            expect(authenticationStore.getState().lastAuthenticator).toBeNull();
        });

        test("should work with selector", () => {
            const mockAuthenticator: LastAuthentication = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            };

            authenticationStore
                .getState()
                .setLastAuthenticator(mockAuthenticator);
            expect(
                selectLastAuthenticator(authenticationStore.getState())
            ).toEqual(mockAuthenticator);
        });
    });

    describe("setLastWebAuthNAction", () => {
        test("should set last WebAuthN action", () => {
            const mockAction: LastWebAuthNAction = {
                wallet: "0x1234567890123456789012345678901234567890",
                signature: {
                    id: "cred-123",
                    response: {
                        metadata: {
                            challenge: "test-challenge",
                            crossOrigin: false,
                            origin: "https://example.com",
                            type: "webauthn.get",
                            userVerified: true,
                        },
                        signature: {
                            r: 0n,
                            s: 0n,
                            yParity: 0,
                        },
                    },
                } as AuthenticationResponseJSON,
                challenge: "0x746573742d6d657373616765",
            };

            authenticationStore.getState().setLastWebAuthNAction(mockAction);
            expect(authenticationStore.getState().lastWebAuthNAction).toEqual(
                mockAction
            );
        });

        test("should clear last WebAuthN action when null", () => {
            const mockAction: LastWebAuthNAction = {
                wallet: "0x1234567890123456789012345678901234567890",
                signature: {
                    id: "cred-123",
                    response: {
                        metadata: {} as any,
                        signature: { r: 0n, s: 0n, yParity: 0 },
                    },
                } as AuthenticationResponseJSON,
                challenge: "0x746573742d6d657373616765",
            };

            authenticationStore.getState().setLastWebAuthNAction(mockAction);
            authenticationStore.getState().setLastWebAuthNAction(null);
            expect(
                authenticationStore.getState().lastWebAuthNAction
            ).toBeNull();
        });

        test("should work with selector", () => {
            const mockAction: LastWebAuthNAction = {
                wallet: "0x1234567890123456789012345678901234567890",
                signature: {
                    id: "cred-123",
                    response: {
                        metadata: {} as any,
                        signature: { r: 0n, s: 0n, yParity: 0 },
                    },
                } as AuthenticationResponseJSON,
                challenge: "0x746573742d6d657373616765",
            };

            authenticationStore.getState().setLastWebAuthNAction(mockAction);
            expect(
                selectLastWebAuthNAction(authenticationStore.getState())
            ).toEqual(mockAction);
        });
    });

    describe("setSsoContext", () => {
        test("should set SSO context", () => {
            const mockSsoContext = {
                productId: "product-123",
                metadata: { name: "Example App" },
            };

            authenticationStore.getState().setSsoContext(mockSsoContext);
            expect(authenticationStore.getState().ssoContext).toEqual(
                mockSsoContext
            );
        });

        test("should clear SSO context when null", () => {
            const mockSsoContext = {
                productId: "product-123",
                metadata: { name: "Example App" },
            };

            authenticationStore.getState().setSsoContext(mockSsoContext);
            authenticationStore.getState().setSsoContext(null);
            expect(authenticationStore.getState().ssoContext).toBeNull();
        });

        test("should work with selector", () => {
            const mockSsoContext = {
                productId: "product-123",
                metadata: { name: "Example App" },
            };

            authenticationStore.getState().setSsoContext(mockSsoContext);
            expect(selectSsoContext(authenticationStore.getState())).toEqual(
                mockSsoContext
            );
        });
    });

    describe("clearAuthentication", () => {
        test("should clear all authentication data", () => {
            const mockAuthenticator: LastAuthentication = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            };
            const mockAction: LastWebAuthNAction = {
                wallet: "0x1234567890123456789012345678901234567890",
                signature: {
                    id: "test-id",
                    response: {
                        metadata: {} as any,
                        signature: { r: 0n, s: 0n, yParity: 0 },
                    },
                } as AuthenticationResponseJSON,
                challenge: "0x74657374",
            };
            const mockSsoContext = { productId: "product-123" };

            // Set all values
            authenticationStore
                .getState()
                .setLastAuthenticator(mockAuthenticator);
            authenticationStore.getState().setLastWebAuthNAction(mockAction);
            authenticationStore.getState().setSsoContext(mockSsoContext);

            // Clear
            authenticationStore.getState().clearAuthentication();

            // Verify all cleared
            const state = authenticationStore.getState();
            expect(state.lastAuthenticator).toBeNull();
            expect(state.lastWebAuthNAction).toBeNull();
            expect(state.ssoContext).toBeNull();
        });
    });

    describe("selectCurrentSsoMetadata", () => {
        test("should return SSO metadata when context exists", () => {
            const mockMetadata = { name: "Example App", domain: "example.com" };
            const mockSsoContext = {
                productId: "product-123",
                metadata: mockMetadata,
            };

            authenticationStore.getState().setSsoContext(mockSsoContext);

            const result = selectCurrentSsoMetadata(
                authenticationStore.getState()
            );
            expect(result).toEqual(mockMetadata);
        });

        test("should return undefined when no SSO context", () => {
            const result = selectCurrentSsoMetadata(
                authenticationStore.getState()
            );
            expect(result).toBeUndefined();
        });

        test("should return undefined when SSO context has no metadata", () => {
            const mockSsoContext = {
                productId: "product-123",
            };

            authenticationStore.getState().setSsoContext(mockSsoContext);

            const result = selectCurrentSsoMetadata(
                authenticationStore.getState()
            );
            expect(result).toBeUndefined();
        });
    });

    describe("addLastAuthentication", () => {
        test("should add webauthn authentication", async () => {
            const { authenticatorStorage } = await import(
                "../common/storage/authenticators"
            );

            const mockSession: Session = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
                transports: ["usb", "nfc"],
            } as Session;

            await addLastAuthentication(mockSession);

            const storedAuth = authenticationStore.getState().lastAuthenticator;
            expect(storedAuth).toBeDefined();
            expect(storedAuth?.address).toBe(mockSession.address);
            expect(storedAuth?.type).toBe("webauthn");
            expect(authenticatorStorage.put).toHaveBeenCalledWith({
                wallet: mockSession.address,
                authenticatorId: mockSession.authenticatorId,
                transports: mockSession.transports,
            });
        });

        test("should add authentication with undefined type (treated as webauthn)", async () => {
            const { authenticatorStorage } = await import(
                "../common/storage/authenticators"
            );

            const mockSession: Session = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
                transports: ["usb"],
            } as Session;

            await addLastAuthentication(mockSession);

            expect(
                authenticationStore.getState().lastAuthenticator
            ).toBeDefined();
            expect(authenticatorStorage.put).toHaveBeenCalled();
        });

        test("should not add ecdsa authentication", async () => {
            const { authenticatorStorage } = await import(
                "../common/storage/authenticators"
            );

            const mockSession: Session = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "ecdsa",
                publicKey: "0x123456",
                authenticatorId: "ecdsa-123",
                transports: undefined,
            } as Session;

            await addLastAuthentication(mockSession);

            expect(authenticationStore.getState().lastAuthenticator).toBeNull();
            expect(authenticatorStorage.put).not.toHaveBeenCalled();
        });

        test("should not add authentication without authenticatorId", async () => {
            const { authenticatorStorage } = await import(
                "../common/storage/authenticators"
            );

            // Intentionally incomplete Session to test validation
            const mockSession = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
                // Missing authenticatorId intentionally
            } as unknown as Session;

            await addLastAuthentication(mockSession);

            expect(authenticationStore.getState().lastAuthenticator).toBeNull();
            expect(authenticatorStorage.put).not.toHaveBeenCalled();
        });

        test("should not add distant-webauthn authentication", async () => {
            const { authenticatorStorage } = await import(
                "../common/storage/authenticators"
            );

            const mockSession: Session = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "distant-webauthn",
                authenticatorId: "auth-123",
                pairingId: "pairing-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
                transports: undefined,
            } as Session;

            await addLastAuthentication(mockSession);

            expect(authenticationStore.getState().lastAuthenticator).toBeNull();
            expect(authenticatorStorage.put).not.toHaveBeenCalled();
        });
    });

    describe("selectors", () => {
        test("should select correct values from state", () => {
            const mockAuthenticator: LastAuthentication = {
                token: "test-token",
                address: "0x1234567890123456789012345678901234567890",
                type: "webauthn",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890123456789012345678901234567890123456789012345678901234",
                    y: "0xabcdef1234567890123456789012345678901234567890123456789012345678",
                },
            };
            const mockAction: LastWebAuthNAction = {
                wallet: "0x1234567890123456789012345678901234567890",
                signature: {
                    id: "test-id",
                    response: {
                        metadata: {} as any,
                        signature: { r: 0n, s: 0n, yParity: 0 },
                    },
                } as AuthenticationResponseJSON,
                challenge: "0x74657374",
            };
            const mockSsoContext = {
                productId: "product-123",
                metadata: { name: "Example App" },
            };

            authenticationStore
                .getState()
                .setLastAuthenticator(mockAuthenticator);
            authenticationStore.getState().setLastWebAuthNAction(mockAction);
            authenticationStore.getState().setSsoContext(mockSsoContext);

            const state = authenticationStore.getState();

            expect(selectLastAuthenticator(state)).toEqual(mockAuthenticator);
            expect(selectLastWebAuthNAction(state)).toEqual(mockAction);
            expect(selectSsoContext(state)).toEqual(mockSsoContext);
            expect(selectCurrentSsoMetadata(state)).toEqual(
                mockSsoContext.metadata
            );
        });
    });
});
