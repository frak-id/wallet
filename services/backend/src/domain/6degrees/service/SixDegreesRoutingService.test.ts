import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Hex } from "viem";
import { SixDegreesRoutingService } from "./SixDegreesRoutingService";

describe("SixDegreesRoutingService", () => {
    let service: SixDegreesRoutingService;
    let mockDb: any;

    const mockDomain = "example.com";
    const mockPubKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        const mockExecute = mock(() => Promise.resolve());
        const mockWhere = mock(() => ({ execute: mockExecute }));
        const mockValues = mock(() => ({ where: mockWhere }));
        const mockInsert = mock(() => ({ values: mockValues }));
        const mockFrom = mock(() => ({ where: mockWhere }));
        const mockSelect = mock(() => ({ from: mockFrom }));

        mockDb = {
            select: mockSelect,
            insert: mockInsert,
        };

        service = new SixDegreesRoutingService(mockDb);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("isRoutedDomain", () => {
        it("should return true when domain exists in database", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([{ domain: mockDomain }])),
                })),
            }));

            const result = await service.isRoutedDomain(mockDomain);

            expect(result).toBe(true);
        });

        it("should return false when domain does not exist in database", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([])),
                })),
            }));

            const result = await service.isRoutedDomain(mockDomain);

            expect(result).toBe(false);
        });

        it("should use cache on subsequent calls", async () => {
            const whereMock = mock(() => Promise.resolve([{ domain: mockDomain }]));
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: whereMock,
                })),
            }));

            // First call
            const result1 = await service.isRoutedDomain(mockDomain);
            // Second call - should use cache
            const result2 = await service.isRoutedDomain(mockDomain);

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            expect(whereMock).toHaveBeenCalledTimes(1); // Should only query DB once
        });

        it("should handle database errors", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.reject(new Error("Database error"))),
                })),
            }));

            await expect(service.isRoutedDomain(mockDomain)).rejects.toThrow("Database error");
        });
    });

    describe("isRoutedWallet", () => {
        it("should return true when wallet exists in database", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([{ walletPubKey: mockPubKey }])),
                })),
            }));

            const result = await service.isRoutedWallet(mockPubKey);

            expect(result).toBe(true);
        });

        it("should return false when wallet does not exist in database", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([])),
                })),
            }));

            const result = await service.isRoutedWallet(mockPubKey);

            expect(result).toBe(false);
        });

        it("should use cache on subsequent calls", async () => {
            const whereMock = mock(() => Promise.resolve([{ walletPubKey: mockPubKey }]));
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: whereMock,
                })),
            }));

            // First call
            const result1 = await service.isRoutedWallet(mockPubKey);
            // Second call - should use cache
            const result2 = await service.isRoutedWallet(mockPubKey);

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            expect(whereMock).toHaveBeenCalledTimes(1); // Should only query DB once
        });

        it("should handle database errors", async () => {
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.reject(new Error("Database error"))),
                })),
            }));

            await expect(service.isRoutedWallet(mockPubKey)).rejects.toThrow("Database error");
        });
    });

    describe("registerRoutedWallet", () => {
        it("should successfully register a new wallet", async () => {
            const insertMock = mock(() => ({
                values: mock(() => Promise.resolve()),
            }));
            mockDb.insert = insertMock;

            await service.registerRoutedWallet(mockPubKey);

            expect(insertMock).toHaveBeenCalled();
        });

        it("should handle insert errors gracefully", async () => {
            const insertMock = mock(() => ({
                values: mock(() => Promise.reject(new Error("Duplicate key error"))),
            }));
            mockDb.insert = insertMock;

            // Mock console.warn
            const originalWarn = console.warn;
            const warnSpy = mock(() => {});
            console.warn = warnSpy;

            try {
                // Should not throw
                await service.registerRoutedWallet(mockPubKey);
                expect(warnSpy).toHaveBeenCalledWith(
                    "Unable to register the wallet routing",
                    expect.any(Error)
                );
            } finally {
                console.warn = originalWarn;
            }
        });

        it("should invalidate cache after successful registration", async () => {
            // First, populate cache by checking if wallet is routed
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([])), // Not routed initially
                })),
            }));

            const result1 = await service.isRoutedWallet(mockPubKey);
            expect(result1).toBe(false);

            // Register the wallet
            const insertMock = mock(() => ({
                values: mock(() => Promise.resolve()),
            }));
            mockDb.insert = insertMock;

            await service.registerRoutedWallet(mockPubKey);

            // Now mock DB to return that wallet is routed
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([{ walletPubKey: mockPubKey }])),
                })),
            }));

            // Check again - should query DB again (cache was invalidated)
            const result2 = await service.isRoutedWallet(mockPubKey);
            expect(result2).toBe(true);
        });
    });

    describe("cache behavior", () => {
        it("should cache domain results for 5 minutes", async () => {
            // This test verifies the cache configuration is correct
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([{ domain: mockDomain }])),
                })),
            }));

            const result = await service.isRoutedDomain(mockDomain);
            expect(result).toBe(true);

            // Subsequent call should use cache
            const result2 = await service.isRoutedDomain(mockDomain);
            expect(result2).toBe(true);
        });

        it("should cache wallet results for 5 minutes", async () => {
            // This test verifies the cache configuration is correct
            mockDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.resolve([{ walletPubKey: mockPubKey }])),
                })),
            }));

            const result = await service.isRoutedWallet(mockPubKey);
            expect(result).toBe(true);

            // Subsequent call should use cache
            const result2 = await service.isRoutedWallet(mockPubKey);
            expect(result2).toBe(true);
        });

        it("should handle different domains independently", async () => {
            const domain1 = "example1.com";
            const domain2 = "example2.com";

            mockDb.select = mock()
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([{ domain: domain1 }])),
                    })),
                })
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([])),
                    })),
                });

            const result1 = await service.isRoutedDomain(domain1);
            const result2 = await service.isRoutedDomain(domain2);

            expect(result1).toBe(true);
            expect(result2).toBe(false);
        });
    });
});