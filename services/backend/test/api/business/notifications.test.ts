import { beforeEach, describe, expect, it } from "vitest";
import { notificationsRoutes } from "../../../src/api/business/notifications";
// Import mocks and routes
import {
    JwtContextMock,
    notificationBroadcastRepositoryMocks,
    notificationOrchestratorMocks,
    notificationServiceMocks,
    resetMockBusinessSession,
    setMockBusinessSession,
} from "../../mock/common";

describe("Business Notifications Route API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        notificationServiceMocks.cleanupExpiredTokens.mockClear();
        notificationServiceMocks.sendNotification.mockClear();
        notificationOrchestratorMocks.sendPromotionalNotification.mockClear();
        resetMockBusinessSession();
        JwtContextMock.business.verify.mockClear();

        notificationBroadcastRepositoryMocks.create.mockClear();
        notificationBroadcastRepositoryMocks.listScheduled.mockClear();
        notificationBroadcastRepositoryMocks.deleteScheduled.mockClear();
        notificationBroadcastRepositoryMocks.create.mockResolvedValue({
            id: "00000000-0000-0000-0000-000000000001",
        } as never);
        notificationBroadcastRepositoryMocks.listScheduled.mockResolvedValue(
            [] as never
        );
        notificationBroadcastRepositoryMocks.deleteScheduled.mockResolvedValue(
            true as never
        );
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

    describe("POST /schedule", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";
        const validPayload = {
            title: "Test Notification",
            body: "This is a test notification",
        };
        const validTargets = {
            wallets: ["0x1111111111111111111111111111111111111111"],
        };
        const futureDate = () =>
            new Date(Date.now() + 60 * 60 * 1000).toISOString();

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: futureDate(),
                    }),
                })
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when scheduledAt is missing", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(422);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should return 400 when scheduledAt is in the past", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: new Date(
                            Date.now() - 60_000
                        ).toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(400);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should create a scheduled broadcast and return its id", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: futureDate(),
                    }),
                })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.id).toBe("00000000-0000-0000-0000-000000000001");
            expect(
                notificationBroadcastRepositoryMocks.create
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    merchantId,
                    targets: validTargets,
                    scheduledAt: expect.any(Date),
                })
            );
        });
    });

    describe("GET /scheduled", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/scheduled?merchantId=${merchantId}`
                )
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.listScheduled
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when merchantId is missing", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/scheduled", {
                    headers: { "x-business-auth": "valid-token" },
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return the merchant's scheduled broadcasts", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const scheduled = [
                {
                    id: "00000000-0000-0000-0000-0000000000aa",
                    payload: { title: "T", body: "B" },
                    targets: {
                        wallets: ["0x1111111111111111111111111111111111111111"],
                    },
                    scheduledAt: "2030-01-01T00:00:00.000Z",
                    createdAt: "2025-01-01T00:00:00.000Z",
                },
            ];
            notificationBroadcastRepositoryMocks.listScheduled.mockResolvedValue(
                scheduled as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/scheduled?merchantId=${merchantId}`,
                    { headers: { "x-business-auth": "valid-token" } }
                )
            );

            expect(response.status).toBe(200);
            expect(
                notificationBroadcastRepositoryMocks.listScheduled
            ).toHaveBeenCalledWith(merchantId);

            const data = await response.json();
            expect(data).toEqual(scheduled);
        });
    });

    describe("DELETE /scheduled/:id", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";
        const scheduledId = "00000000-0000-0000-0000-0000000000aa";

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/scheduled/${scheduledId}?merchantId=${merchantId}`,
                    { method: "DELETE" }
                )
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.deleteScheduled
            ).not.toHaveBeenCalled();
        });

        it("should return 404 when the scheduled notification does not exist", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.deleteScheduled.mockResolvedValue(
                false as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/scheduled/${scheduledId}?merchantId=${merchantId}`,
                    {
                        method: "DELETE",
                        headers: { "x-business-auth": "valid-token" },
                    }
                )
            );

            expect(response.status).toBe(404);
        });

        it("should delete the scheduled notification and return 200", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.deleteScheduled.mockResolvedValue(
                true as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/scheduled/${scheduledId}?merchantId=${merchantId}`,
                    {
                        method: "DELETE",
                        headers: { "x-business-auth": "valid-token" },
                    }
                )
            );

            expect(response.status).toBe(200);
            expect(
                notificationBroadcastRepositoryMocks.deleteScheduled
            ).toHaveBeenCalledWith(scheduledId, merchantId);

            const data = await response.json();
            expect(data).toEqual({ deleted: true });
        });
    });
});
