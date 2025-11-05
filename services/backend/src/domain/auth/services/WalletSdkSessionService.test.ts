import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { Address } from "viem";
import { mockAll } from "../../../../test/mock";
import { JwtContextMock } from "../../../../test/mock/common";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";
import { WalletSdkSessionService } from "./WalletSdkSessionService";

describe("WalletSdkSessionService", () => {
    let service: WalletSdkSessionService;

    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;

    beforeAll(() => {
        mockAll();
        service = new WalletSdkSessionService();

        // Reset the mock to clear any previous calls
        JwtContextMock.walletSdk.sign.mockReset();
        JwtContextMock.walletSdk.sign.mockImplementation(() =>
            Promise.resolve("mock-jwt-token")
        );
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

            expect(JwtContextMock.walletSdk.sign).toHaveBeenCalledWith({
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

            expect(JwtContextMock.walletSdk.sign).toHaveBeenCalledWith({
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

            expect(JwtContextMock.walletSdk.sign).toHaveBeenCalledWith({
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

                expect(JwtContextMock.walletSdk.sign).toHaveBeenCalledWith(
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
            // Mock the sign to throw an error for this test
            JwtContextMock.walletSdk.sign.mockImplementationOnce(() =>
                Promise.reject(new Error("JWT signing failed"))
            );

            await expect(
                service.generateSdkJwt({
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
