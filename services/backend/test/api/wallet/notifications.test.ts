import { beforeEach, describe, expect, it } from "vitest";
import { tokensRoutes } from "../../../src/api/wallet/routes/notifications/tokens";
import { dbMock, JwtContextMock } from "../../mock/common";

describe("Wallet Notifications Token Routes API", () => {
    const mockWalletAddress = "0x1234567890123456789012345678901234567890";
    const validAuthToken = "valid-jwt-token";

    beforeEach(() => {
        // Reset all mocks before each test
        dbMock.__reset();
        JwtContextMock.wallet.verify.mockClear();
        JwtContextMock.wallet.sign.mockClear();
    });

    describe("PUT /tokens", () => {
        const validSubscription = {
            subscription: {
                endpoint:
                    "https://fcm.googleapis.com/fcm/send/test-endpoint-123",
                keys: {
                    p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
                    auth: "tBHItJI5svbpez7KI4CCXg==",
                },
            },
        };

        it("should register push token when authenticated with valid data", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make PUT request with auth header
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(validSubscription),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                validAuthToken
            );
        });

        it("should register push token with expiration time when provided", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setInsertResponse(() => Promise.resolve([]));

            const subscriptionWithExpiration = {
                subscription: {
                    ...validSubscription.subscription,
                    expirationTime: Date.now() + 86400000, // 24 hours from now
                },
            };

            // Act: Make PUT request
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(subscriptionWithExpiration),
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make PUT request without auth header
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(validSubscription),
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make PUT request with invalid token
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": "invalid-token",
                    },
                    body: JSON.stringify(validSubscription),
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });

        it("should return 422 when subscription object is missing", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Act: Make PUT request with missing subscription
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify({}),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when endpoint is missing", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const invalidSubscription = {
                subscription: {
                    keys: {
                        p256dh: "test-p256dh",
                        auth: "test-auth",
                    },
                },
            };

            // Act: Make PUT request with missing endpoint
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(invalidSubscription),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when keys.p256dh is missing", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const invalidSubscription = {
                subscription: {
                    endpoint: "https://fcm.googleapis.com/fcm/send/test",
                    keys: {
                        auth: "test-auth",
                    },
                },
            };

            // Act: Make PUT request with missing p256dh key
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(invalidSubscription),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when keys.auth is missing", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            const invalidSubscription = {
                subscription: {
                    endpoint: "https://fcm.googleapis.com/fcm/send/test",
                    keys: {
                        p256dh: "test-p256dh",
                    },
                },
            };

            // Act: Make PUT request with missing auth key
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(invalidSubscription),
                })
            );

            // Assert: Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
        });

        it("should return 422 when request body is invalid JSON", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Act: Make PUT request with invalid JSON
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: "invalid-json{",
                })
            );

            // Assert: Should return error (Elysia handles parse errors)
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it("should handle onConflictDoNothing for duplicate tokens", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Mock insert that does nothing on conflict (returns empty array)
            dbMock.__setInsertResponse(() => Promise.resolve([]));

            // Act: Make PUT request with same subscription twice
            const response1 = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(validSubscription),
                })
            );

            const response2 = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-wallet-auth": validAuthToken,
                    },
                    body: JSON.stringify(validSubscription),
                })
            );

            // Assert: Both should succeed (onConflictDoNothing)
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });
    });

    describe("DELETE /tokens", () => {
        it("should delete all push tokens for authenticated wallet", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            // Act: Make DELETE request
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "DELETE",
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                validAuthToken
            );
            expect(dbMock.__getDeleteExecuteMock()).toHaveBeenCalled();
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make DELETE request without auth header
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "DELETE",
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make DELETE request with invalid token
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens", {
                    method: "DELETE",
                    headers: {
                        "x-wallet-auth": "invalid-token",
                    },
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });
    });

    describe("GET /tokens/hasAny", () => {
        it("should return true when wallet has push tokens", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Mock findFirst returning a token
            dbMock.__setSelectResponse(() =>
                Promise.resolve([
                    {
                        wallet: mockWalletAddress,
                        endpoint: "https://fcm.googleapis.com/test",
                    },
                ])
            );

            // Act: Make GET request
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens/hasAny", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return true
            expect(response.status).toBe(200);
            const hasTokens = await response.json();
            expect(hasTokens).toBe(true);
        });

        it("should return false when wallet has no push tokens", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            // Mock findFirst returning undefined (no tokens)
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens/hasAny", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return false
            expect(response.status).toBe(200);
            const hasTokens = await response.json();
            expect(hasTokens).toBe(false);
        });

        it("should return 401 when x-wallet-auth header is missing", async () => {
            // Act: Make GET request without auth header
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens/hasAny")
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();
        });

        it("should return 401 when JWT verification fails", async () => {
            // Arrange: Mock failed authentication
            JwtContextMock.wallet.verify.mockResolvedValue(false as never);

            // Act: Make GET request with invalid token
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens/hasAny", {
                    headers: {
                        "x-wallet-auth": "invalid-token",
                    },
                })
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-token"
            );
        });

        it("should return boolean value as response body", async () => {
            // Arrange: Mock successful authentication
            JwtContextMock.wallet.verify.mockResolvedValue({
                address: mockWalletAddress,
                authenticatorId: "test-auth-id",
                publicKey: { x: "0x123", y: "0x456" },
            } as never);

            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await tokensRoutes.handle(
                new Request("http://localhost/tokens/hasAny", {
                    headers: {
                        "x-wallet-auth": validAuthToken,
                    },
                })
            );

            // Assert: Should return 200 with boolean value
            expect(response.status).toBe(200);
            const bodyText = await response.text();
            expect(bodyText).toBe("false");
        });
    });
});
