import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { Address } from "viem";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";
import { WalletSdkSessionService } from "./WalletSdkSessionService";

describe("WalletSdkSessionService", () => {
    let service: WalletSdkSessionService;

    const mockWalletSdkJwt = {
        sign: mock(() => Promise.resolve("mock-jwt-token")),
    };

    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;

    beforeAll(() => {
        service = new WalletSdkSessionService(mockWalletSdkJwt);
    });

    afterAll(() => {
        mock.restore();
    });

    describe("generateSdkJwt", () => {
        it("should generate JWT token with minimal payload", async () => {
            const mockCurrentTime = 1609459200000; // Jan 1, 2021
            const originalDateNow = Date.now;
            Date.now = mock(() => mockCurrentTime);

            const result = await service.generateSdkJwt({
                wallet: mockWallet,
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData: undefined,
            });

            expect(result).toEqual({
                token: "mock-jwt-token",
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7, // 7 days from now
            });

            // Restore Date.now
            Date.now = originalDateNow;
        });

        it("should generate JWT token with additional data", async () => {
            const mockCurrentTime = 1609459200000; // Jan 1, 2021
            const originalDateNow = Date.now;
            Date.now = mock(() => mockCurrentTime);

            const additionalData: StaticWalletSdkTokenDto["additionalData"] = {
                customField: "customValue",
                numericField: 123,
                booleanField: true,
            };

            const result = await service.generateSdkJwt({
                wallet: mockWallet,
                additionalData,
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData,
            });

            expect(result).toEqual({
                token: "mock-jwt-token",
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7,
            });

            // Restore Date.now
            Date.now = originalDateNow;
        });

        it("should handle empty additional data object", async () => {
            const mockCurrentTime = 1609459200000;
            const originalDateNow = Date.now;
            Date.now = mock(() => mockCurrentTime);

            const result = await service.generateSdkJwt({
                wallet: mockWallet,
                additionalData: {}, // Empty object
            });

            expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith({
                address: mockWallet,
                scopes: ["interaction"],
                sub: mockWallet,
                iat: mockCurrentTime,
                additionalData: undefined, // Should be undefined for empty object
            });

            expect(result).toEqual({
                token: "mock-jwt-token",
                expires: mockCurrentTime + 60_000 * 60 * 24 * 7,
            });

            // Restore Date.now
            Date.now = originalDateNow;
        });

        it("should handle different wallet addresses", async () => {
            const testWallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                "0x0000000000000000000000000000000000000000",
            ] as Address[];

            const mockCurrentTime = 1609459200000;
            const originalDateNow = Date.now;
            Date.now = mock(() => mockCurrentTime);

            for (const wallet of testWallets) {
                await service.generateSdkJwt({ wallet });

                expect(mockWalletSdkJwt.sign).toHaveBeenCalledWith(
                    expect.objectContaining({
                        address: wallet,
                        sub: wallet,
                    })
                );
            }

            // Restore Date.now
            Date.now = originalDateNow;
        });

        it("should handle JWT signing errors gracefully", async () => {
            const errorJwt = {
                sign: mock(() =>
                    Promise.reject(new Error("JWT signing failed"))
                ),
            };

            const serviceWithError = new WalletSdkSessionService(errorJwt);

            await expect(
                serviceWithError.generateSdkJwt({
                    wallet: mockWallet,
                })
            ).rejects.toThrow("JWT signing failed");
        });

        it("should calculate correct expiration time", async () => {
            const mockCurrentTime = 1609459200000; // Jan 1, 2021
            const originalDateNow = Date.now;
            Date.now = mock(() => mockCurrentTime);

            const result = await service.generateSdkJwt({
                wallet: mockWallet,
            });

            const expectedExpiration = mockCurrentTime + 60_000 * 60 * 24 * 7; // 7 days in milliseconds
            expect(result.expires).toBe(expectedExpiration);

            // Restore Date.now
            Date.now = originalDateNow;
        });
    });
});
