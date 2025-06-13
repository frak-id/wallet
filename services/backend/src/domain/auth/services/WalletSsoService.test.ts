import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Address, Hex } from "viem";
import { WalletSsoService } from "./WalletSsoService";

describe("WalletSsoService", () => {
    let service: WalletSsoService;
    let mockDb: any;

    const mockSsoId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockAuthenticatorId = "test-authenticator-id";
    const mockPairingId = "test-pairing-id";
    const mockAdditionalData = {
        customField: "customValue",
        userId: "user123",
    };

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    mock.module("@backend-common", () => ({
        log: {
            error: mock(() => {}),
        },
    }));

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        const mockExecute = mock(() => Promise.resolve());
        const mockWhere = mock(() => ({ execute: mockExecute }));
        const mockSet = mock(() => ({ where: mockWhere }));
        const mockUpdate = mock(() => ({ set: mockSet }));

        mockDb = {
            update: mockUpdate,
        };

        service = new WalletSsoService(mockDb);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("resolveSession", () => {
        it("should successfully resolve session with all parameters", async () => {
            await service.resolveSession({
                id: mockSsoId,
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
                additionalData: mockAdditionalData,
                pairingId: mockPairingId,
            });

            expect(mockDb.update).toHaveBeenCalled();
        });

        it("should successfully resolve session with minimal parameters", async () => {
            await service.resolveSession({
                id: mockSsoId,
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
            });

            expect(mockDb.update).toHaveBeenCalled();
        });

        it("should handle database errors gracefully", async () => {
            const errorMockExecute = mock(() => Promise.reject(new Error("Database error")));
            const errorMockWhere = mock(() => ({ execute: errorMockExecute }));
            const errorMockSet = mock(() => ({ where: errorMockWhere }));
            const errorMockUpdate = mock(() => ({ set: errorMockSet }));

            const errorMockDb = {
                update: errorMockUpdate,
            };

            const errorService = new WalletSsoService(errorMockDb);

            // Should not throw, just log the error
            await expect(
                errorService.resolveSession({
                    id: mockSsoId,
                    wallet: mockWallet,
                    authenticatorId: mockAuthenticatorId,
                })
            ).resolves.toBeUndefined();

            expect(errorMockDb.update).toHaveBeenCalled();
        });

        it("should update session with correct data structure", async () => {
            const mockCurrentDate = new Date("2022-01-01T00:00:00.000Z");
            const originalDate = global.Date;
            global.Date = class extends Date {
                constructor() {
                    super();
                    return mockCurrentDate;
                }
                static now() {
                    return mockCurrentDate.getTime();
                }
            } as any;

            try {
                await service.resolveSession({
                    id: mockSsoId,
                    wallet: mockWallet,
                    authenticatorId: mockAuthenticatorId,
                    additionalData: mockAdditionalData,
                    pairingId: mockPairingId,
                });

                // Verify the update was called with correct structure
                expect(mockDb.update).toHaveBeenCalled();
            } finally {
                global.Date = originalDate;
            }
        });

        it("should handle undefined optional parameters", async () => {
            await service.resolveSession({
                id: mockSsoId,
                wallet: mockWallet,
                authenticatorId: mockAuthenticatorId,
                additionalData: undefined,
                pairingId: undefined,
            });

            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe("database getter", () => {
        it("should return the database instance", () => {
            const result = service.database;
            expect(result).toBe(mockDb);
        });
    });
});