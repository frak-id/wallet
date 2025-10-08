import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Address, Hex } from "viem";
import { ssoTable } from "../db/schema";
import type { StaticWalletSdkTokenDto } from "../models/WalletSessionDto";
import { WalletSsoService } from "./WalletSsoService";

describe("WalletSsoService", () => {
    const db = drizzle.mock({ schema: { ssoTable } });
    let service: WalletSsoService;

    const mockSsoId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockWallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
    const mockAuthenticatorId = "authenticator-123";
    const mockPairingId = "pairing-456";

    beforeAll(() => {
        service = new WalletSsoService();
    });

    afterAll(() => {
        mock.restore();
    });

    describe("resolveSession", () => {
        it("should successfully resolve session with minimal data", async () => {
            const mockSet = mock(() => ({
                where: mock(() => ({
                    execute: mock(() => Promise.resolve()),
                })),
            }));
            const mockUpdate = mock(() => ({
                set: mockSet,
            }));

            Object.assign(db, {
                update: mockUpdate,
            });

            await service.resolveSession({
                id: mockSsoId,
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
            });

            expect(db.update).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({
                resolvedAt: expect.any(Date),
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
                sdkTokenAdditionalData: undefined,
                pairingId: undefined,
            });
        });

        it("should successfully resolve session with additional data", async () => {
            const mockSet = mock(() => ({
                where: mock(() => ({
                    execute: mock(() => Promise.resolve()),
                })),
            }));
            const mockUpdate = mock(() => ({
                set: mockSet,
            }));

            Object.assign(db, {
                update: mockUpdate,
            });

            const additionalData: StaticWalletSdkTokenDto["additionalData"] = {
                customField: "customValue",
                numericField: 123,
            };

            await service.resolveSession({
                id: mockSsoId,
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
                additionalData,
                pairingId: mockPairingId,
            });

            expect(db.update).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({
                resolvedAt: expect.any(Date),
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
                sdkTokenAdditionalData: additionalData,
                pairingId: mockPairingId,
            });
        });

        it("should handle database errors gracefully", async () => {
            const mockSet = mock(() => ({
                where: mock(() => ({
                    execute: mock(() =>
                        Promise.reject(new Error("Database error"))
                    ),
                })),
            }));
            const mockUpdate = mock(() => ({
                set: mockSet,
            }));

            Object.assign(db, {
                update: mockUpdate,
            });

            // Should not throw even if database operation fails
            await expect(
                service.resolveSession({
                    id: mockSsoId,
                    wallet: mockWallet,
                    authenticatorId: mockAuthenticatorId,
                })
            ).resolves.toBeUndefined();
        });

        it("should handle various wallet addresses", async () => {
            const mockSet = mock(() => ({
                where: mock(() => ({
                    execute: mock(() => Promise.resolve()),
                })),
            }));
            const mockUpdate = mock(() => ({
                set: mockSet,
            }));

            Object.assign(db, {
                update: mockUpdate,
            });

            const testWallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                "0x0000000000000000000000000000000000000000",
            ] as Address[];

            for (const wallet of testWallets) {
                await service.resolveSession({
                    id: mockSsoId,
                    wallet,
                    authenticatorId: mockAuthenticatorId,
                });

                expect(mockSet).toHaveBeenCalledWith(
                    expect.objectContaining({
                        wallet,
                    })
                );
            }
        });
    });
});
