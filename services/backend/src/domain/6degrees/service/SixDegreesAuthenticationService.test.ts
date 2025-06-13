import { describe, expect, it, mock } from "bun:test";
import { SixDegreesAuthenticationService } from "./SixDegreesAuthenticationService";

describe("SixDegreesAuthenticationService", () => {
    const mockPublicKey = new Uint8Array([1, 2, 3, 4, 5]);
    const mockChallenge = "test-challenge";
    const mockSignature = "test-signature";
    const mockToken = "mock-jwt-token";

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    mock.module("@backend-common", () => ({
        log: {
            warn: mock(() => {}),
        },
    }));

    mock.module("@frak-labs/app-essentials", () => ({
        WebAuthN: {
            rpId: "example.com",
            rpOrigin: "https://example.com",
        },
    }));

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("register", () => {
        it("should successfully register and return token", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () =>
                            Promise.resolve({
                                success: true,
                                message: "Registration successful",
                                responseObject: {
                                    userId: "user123",
                                    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
                                    token: mockToken,
                                    expiresAt: "2024-01-01T00:00:00.000Z",
                                },
                                statusCode: 200,
                            }),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.register({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBe(mockToken);
            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/register", {
                json: {
                    publicKey: Buffer.from(mockPublicKey).toString("base64"),
                    challenge: mockChallenge,
                    signature: mockSignature,
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
            });
        });

        it("should return undefined when registration fails", async () => {
            const mockApi = {
                post: mock(() => Promise.reject(new Error("Network error"))),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.register({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when response has no token", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () =>
                            Promise.resolve({
                                success: false,
                                message: "Registration failed",
                                responseObject: null,
                                statusCode: 400,
                            }),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.register({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });

        it("should handle malformed response gracefully", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () => Promise.resolve(null),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.register({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });
    });

    describe("login", () => {
        it("should successfully login and return token", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () =>
                            Promise.resolve({
                                success: true,
                                message: "Login successful",
                                responseObject: {
                                    exists: true,
                                    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
                                    token: mockToken,
                                    expiresAt: "2024-01-01T00:00:00.000Z",
                                },
                                statusCode: 200,
                            }),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.login({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBe(mockToken);
            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/login", {
                json: {
                    publicKey: Buffer.from(mockPublicKey).toString("base64"),
                    challenge: mockChallenge,
                    signature: mockSignature,
                    context: {
                        rpId: "example.com",
                        rpOrigin: "https://example.com",
                        domain: "example.com",
                    },
                },
            });
        });

        it("should return undefined when login fails", async () => {
            const mockApi = {
                post: mock(() => Promise.reject(new Error("Network error"))),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.login({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when user doesn't exist", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () =>
                            Promise.resolve({
                                success: true,
                                message: "User not found",
                                responseObject: {
                                    exists: false,
                                    walletAddress: null,
                                    token: null,
                                    expiresAt: null,
                                },
                                statusCode: 200,
                            }),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.login({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });

        it("should handle JSON parsing errors", async () => {
            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () => Promise.reject(new Error("Invalid JSON")),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            const result = await service.login({
                publicKey: mockPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(result).toBeUndefined();
        });
    });

    describe("base64 encoding", () => {
        it("should correctly encode public key to base64", async () => {
            const testPublicKey = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in bytes
            const expectedBase64 = Buffer.from(testPublicKey).toString("base64");

            const mockApi = {
                post: mock(() =>
                    Promise.resolve({
                        json: () =>
                            Promise.resolve({
                                responseObject: { token: mockToken },
                            }),
                    })
                ),
            };

            const service = new SixDegreesAuthenticationService(mockApi as any);

            await service.register({
                publicKey: testPublicKey,
                challenge: mockChallenge,
                signature: mockSignature,
            });

            expect(mockApi.post).toHaveBeenCalledWith("api/users/webauthn/register", {
                json: expect.objectContaining({
                    publicKey: expectedBase64,
                }),
            });
        });
    });
});