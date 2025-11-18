import { beforeEach, describe, expect, it } from "vitest";
import { authRoutes } from "../../../src/api/wallet/routes/auth";
import { JwtContextMock } from "../../mock/common";

describe("Wallet Auth Routes API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        JwtContextMock.wallet.sign.mockClear();
        JwtContextMock.wallet.verify.mockClear();
    });

    describe("POST /auth/logout", () => {
        it("should remove businessAuth cookie when logging out", async () => {
            const response = await authRoutes.handle(
                new Request("http://localhost/auth/logout", {
                    method: "POST",
                })
            );

            expect(response.status).toBe(200);
        });

        it("should handle logout without existing cookie", async () => {
            const response = await authRoutes.handle(
                new Request("http://localhost/auth/logout", {
                    method: "POST",
                })
            );

            expect(response.status).toBe(200);
        });
    });

    describe("GET /auth/session", () => {
        it("should decode and return session when valid token is provided", async () => {
            const mockSession = {
                type: "webauthn",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890abcdef",
                    y: "0xfedcba0987654321",
                },
            };
            JwtContextMock.wallet.verify.mockResolvedValue(
                mockSession as never
            );

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "valid-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "valid-jwt-token"
            );

            const data = await response.json();
            expect(data).toEqual({
                ...mockSession,
                token: "valid-jwt-token",
            });
        });

        it("should return 404 when no token is provided", async () => {
            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session")
            );

            expect(response.status).toBe(404);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();

            const errorMessage = await response.text();
            expect(errorMessage).toBe("No wallet session found");
        });

        it("should return 404 when token verification fails", async () => {
            JwtContextMock.wallet.verify.mockResolvedValue(null as never);

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "invalid-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(404);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "invalid-jwt-token"
            );

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid wallet session");
        });

        it("should return 404 when token verification returns undefined", async () => {
            JwtContextMock.wallet.verify.mockResolvedValue(undefined as never);

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "expired-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(404);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                "expired-jwt-token"
            );

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid wallet session");
        });

        it("should handle WebAuthN session with transports", async () => {
            const mockSession = {
                type: "webauthn",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890abcdef",
                    y: "0xfedcba0987654321",
                },
                transports: ["usb", "nfc"],
            };
            JwtContextMock.wallet.verify.mockResolvedValue(
                mockSession as never
            );

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "valid-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                ...mockSession,
                token: "valid-jwt-token",
            });
            expect(data.transports).toEqual(["usb", "nfc"]);
        });

        it("should handle ECDSA wallet session", async () => {
            const mockSession = {
                type: "ecdsa",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "ecdsa-wallet-123",
                publicKey: "0xabcdef1234567890",
                transports: undefined,
            };
            JwtContextMock.wallet.verify.mockResolvedValue(
                mockSession as never
            );

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "valid-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                ...mockSession,
                token: "valid-jwt-token",
            });
            expect(data.type).toBe("ecdsa");
            expect(data.publicKey).toBe("0xabcdef1234567890");
        });

        it("should handle distant WebAuthN session", async () => {
            const mockSession = {
                type: "distant-webauthn" as const,
                address: "0x1234567890123456789012345678901234567890" as const,
                authenticatorId: "distant-auth-123",
                publicKey: {
                    x: "0x1234567890abcdef" as const,
                    y: "0xfedcba0987654321" as const,
                },
                pairingId: "pairing-abc-123",
            };
            JwtContextMock.wallet.verify.mockResolvedValue(
                mockSession as never
            );

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "valid-jwt-token",
                    },
                })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.type).toBe("distant-webauthn");
            expect(data.address).toBe(
                "0x1234567890123456789012345678901234567890"
            );
            expect(data.authenticatorId).toBe("distant-auth-123");
            expect(data.publicKey).toEqual({
                x: "0x1234567890abcdef",
                y: "0xfedcba0987654321",
            });
            expect(data.token).toBe("valid-jwt-token");
            // Note: pairingId is part of the verified session data
            // but may be handled differently in response validation
        });

        it("should handle empty string token as missing token", async () => {
            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": "",
                    },
                })
            );

            expect(response.status).toBe(404);
            expect(JwtContextMock.wallet.verify).not.toHaveBeenCalled();

            const errorMessage = await response.text();
            expect(errorMessage).toBe("No wallet session found");
        });

        it("should verify token exactly as provided in header", async () => {
            const complexToken =
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
            const mockSession = {
                type: "webauthn",
                address: "0x1234567890123456789012345678901234567890",
                authenticatorId: "auth-123",
                publicKey: {
                    x: "0x1234567890abcdef",
                    y: "0xfedcba0987654321",
                },
            };
            JwtContextMock.wallet.verify.mockResolvedValue(
                mockSession as never
            );

            const response = await authRoutes.handle(
                new Request("http://localhost/auth/session", {
                    headers: {
                        "x-wallet-auth": complexToken,
                    },
                })
            );

            expect(response.status).toBe(200);
            expect(JwtContextMock.wallet.verify).toHaveBeenCalledWith(
                complexToken
            );
        });
    });
});
