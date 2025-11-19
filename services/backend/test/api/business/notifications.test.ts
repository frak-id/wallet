import { beforeEach, describe, expect, it } from "vitest";
import { sendRoutes } from "../../../src/api/business/routes/notifications/send";
// Import mocks and routes
import {
    JwtContextMock,
    notificationServiceMocks,
    resetMockBusinessSession,
    setMockBusinessSession,
} from "../../mock/common";

/**
 * Helper to create authenticated request headers
 */
function createAuthHeaders(): HeadersInit {
    return {
        "x-business-auth": "mock-business-jwt-token",
    };
}

describe("Business Notifications Send Route API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        notificationServiceMocks.cleanupExpiredTokens.mockClear();
        notificationServiceMocks.sendNotification.mockClear();
        resetMockBusinessSession();
        JwtContextMock.business.verify.mockClear();
    });

    describe("POST /send", () => {
        const validPayload = {
            title: "Test Notification",
            body: "This is a test notification",
        };

        const validTargetsWithWallets = {
            wallets: [
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222",
            ],
        };

        it("should return early when businessSession is missing", async () => {
            // Arrange: No business session
            // (resetMockBusinessSession already called in beforeEach)

            notificationServiceMocks.cleanupExpiredTokens.mockResolvedValue(
                undefined
            );
            notificationServiceMocks.sendNotification.mockResolvedValue(
                undefined
            );

            // Act: Make POST request without business session
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: validTargetsWithWallets,
                        payload: validPayload,
                    }),
                })
            );

            // Assert: Should return early (no body, but 200 status)
            expect(response.status).toBe(200);

            // Services should NOT be called when session is missing
            expect(
                notificationServiceMocks.cleanupExpiredTokens
            ).not.toHaveBeenCalled();
            expect(
                notificationServiceMocks.sendNotification
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when targets are missing", async () => {
            // Act: Make POST request without targets
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        payload: validPayload,
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when payload is missing", async () => {
            // Act: Make POST request without payload
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: validTargetsWithWallets,
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.title is missing", async () => {
            // Act: Make POST request with payload missing title
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: validTargetsWithWallets,
                        payload: {
                            body: "Test body",
                        },
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.body is missing", async () => {
            // Act: Make POST request with payload missing body
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: validTargetsWithWallets,
                        payload: {
                            title: "Test title",
                        },
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when targets.wallets contains invalid addresses", async () => {
            // Act: Make POST request with invalid wallet addresses
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: {
                            wallets: ["not-a-valid-address", "0x123"],
                        },
                        payload: validPayload,
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when targets is empty object", async () => {
            // Act: Make POST request with empty targets object
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        targets: {},
                        payload: validPayload,
                    }),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 400 when request body is invalid JSON", async () => {
            // Act: Make POST request with invalid JSON
            const response = await sendRoutes.handle(
                new Request("http://localhost/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: "{ invalid json",
                })
            );

            // Assert: Should return 400 bad request error
            expect(response.status).toBe(400);
        });
    });
});
