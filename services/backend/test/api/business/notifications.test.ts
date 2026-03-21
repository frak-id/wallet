import { beforeEach, describe, expect, it } from "vitest";
import { notificationsRoutes } from "../../../src/api/business/notifications";
// Import mocks and routes
import {
    JwtContextMock,
    notificationOrchestratorMocks,
    notificationServiceMocks,
    resetMockBusinessSession,
    setMockBusinessSession,
} from "../../mock/common";

describe("Business Notifications Send Route API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        notificationServiceMocks.cleanupExpiredTokens.mockClear();
        notificationServiceMocks.sendNotification.mockClear();
        notificationOrchestratorMocks.sendPromotionalNotification.mockClear();
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

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(401);

            expect(
                notificationServiceMocks.cleanupExpiredTokens
            ).not.toHaveBeenCalled();
            expect(
                notificationServiceMocks.sendNotification
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when targets are missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.title is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: {
                            body: "Test body",
                        },
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.body is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: {
                            title: "Test title",
                        },
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should handle targets.wallets with invalid addresses gracefully", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: {
                            wallets: ["not-a-valid-address", "0x123"],
                        },
                        payload: validPayload,
                    }),
                })
            );

            // Elysia Union validation does not reject invalid sub-member content,
            // so the handler processes the request with the provided addresses
            expect(response.status).toBe(200);
            expect(
                notificationOrchestratorMocks.sendPromotionalNotification
            ).toHaveBeenCalled();
        });

        it("should handle empty targets object gracefully", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: {},
                        payload: validPayload,
                    }),
                })
            );

            // Elysia Union validation does not reject empty targets,
            // handler falls through to filter branch returning empty wallets
            expect(response.status).toBe(200);
            expect(
                notificationOrchestratorMocks.sendPromotionalNotification
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    wallets: [],
                })
            );
        });

        it("should return 400 when request body is invalid JSON", async () => {
            // Act: Make POST request with invalid JSON
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
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
