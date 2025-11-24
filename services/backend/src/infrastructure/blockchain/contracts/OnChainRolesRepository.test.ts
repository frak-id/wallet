import { addresses, productRoles } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viemActionsMocks } from "../../../../test/mock";
import { OnChainRolesRepository } from "./OnChainRolesRepository";

describe("OnChainRolesRepository", () => {
    let repository: OnChainRolesRepository;
    const mockWallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockProductId = 123n;
    const mockOwner = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

    beforeEach(() => {
        repository = new OnChainRolesRepository();
        vi.clearAllMocks();
    });

    describe("getRolesOnProduct", () => {
        it("should return roles when wallet is the owner", async () => {
            viemActionsMocks.multicall.mockResolvedValue([
                mockWallet, // ownerOf returns the wallet itself
                0n, // rolesOf returns no additional roles
            ]);

            const result = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });

            expect(result).toEqual({
                isOwner: true,
                roles: 0n,
            });
            expect(viemActionsMocks.multicall).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    contracts: expect.arrayContaining([
                        expect.objectContaining({
                            address: addresses.productRegistry,
                            functionName: "ownerOf",
                            args: [mockProductId],
                        }),
                        expect.objectContaining({
                            address: addresses.productAdministratorRegistry,
                            functionName: "rolesOf",
                            args: [mockProductId, mockWallet],
                        }),
                    ]),
                })
            );
        });

        it("should return roles when wallet is not the owner", async () => {
            const roles = 5n; // Some role bits set
            viemActionsMocks.multicall.mockResolvedValue([
                mockOwner, // Different owner
                roles,
            ]);

            const result = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });

            expect(result).toEqual({
                isOwner: false,
                roles: roles,
            });
        });

        it("should cache roles for the same wallet and product", async () => {
            viemActionsMocks.multicall.mockResolvedValue([mockOwner, 5n]);

            // First call
            const result1 = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(1);
            expect(result1).toEqual(result2);
        });

        it("should fetch different roles for different wallets", async () => {
            const wallet2 =
                "0x9999999999999999999999999999999999999999" as Address;

            viemActionsMocks.multicall
                .mockResolvedValueOnce([mockOwner, 5n])
                .mockResolvedValueOnce([mockOwner, 10n]);

            const result1 = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            const result2 = await repository.getRolesOnProduct({
                wallet: wallet2,
                productId: mockProductId,
            });

            expect(result1.roles).toBe(5n);
            expect(result2.roles).toBe(10n);
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(2);
        });

        it("should fetch different roles for different products", async () => {
            const productId2 = 456n;

            viemActionsMocks.multicall
                .mockResolvedValueOnce([mockOwner, 5n])
                .mockResolvedValueOnce([mockOwner, 10n]);

            const result1 = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            const result2 = await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: productId2,
            });

            expect(result1.roles).toBe(5n);
            expect(result2.roles).toBe(10n);
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(2);
        });
    });

    describe("hasRoleOrAdminOnProduct", () => {
        it("should return true when wallet is the owner", async () => {
            viemActionsMocks.multicall.mockResolvedValue([mockWallet, 0n]);

            const result = await repository.hasRoleOrAdminOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
                role: productRoles.campaignManager,
            });

            expect(result).toBe(true);
        });

        it("should return true when wallet has the specific role", async () => {
            viemActionsMocks.multicall.mockResolvedValue([
                mockOwner,
                productRoles.campaignManager,
            ]);

            const result = await repository.hasRoleOrAdminOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
                role: productRoles.campaignManager,
            });

            expect(result).toBe(true);
        });

        it("should return true when wallet has admin role", async () => {
            viemActionsMocks.multicall.mockResolvedValue([
                mockOwner,
                productRoles.productAdministrator,
            ]);

            const result = await repository.hasRoleOrAdminOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
                role: productRoles.campaignManager,
            });

            expect(result).toBe(true);
        });

        it("should return false when wallet has neither role nor admin", async () => {
            viemActionsMocks.multicall.mockResolvedValue([mockOwner, 0n]);

            const result = await repository.hasRoleOrAdminOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
                role: productRoles.campaignManager,
            });

            expect(result).toBe(false);
        });

        it("should return true when wallet has multiple roles including the requested one", async () => {
            const multipleRoles =
                productRoles.campaignManager | productRoles.interactionManager;
            viemActionsMocks.multicall.mockResolvedValue([
                mockOwner,
                multipleRoles,
            ]);

            const result = await repository.hasRoleOrAdminOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
                role: productRoles.campaignManager,
            });

            expect(result).toBe(true);
        });
    });

    describe("hasRoles", () => {
        it("should return true when role is present", () => {
            const onChainRoles = productRoles.campaignManager;
            const role = productRoles.campaignManager;

            const result = repository.hasRoles({ onChainRoles, role });

            expect(result).toBe(true);
        });

        it("should return false when role is not present", () => {
            const onChainRoles = productRoles.campaignManager;
            const role = productRoles.interactionManager;

            const result = repository.hasRoles({ onChainRoles, role });

            expect(result).toBe(false);
        });

        it("should return true when multiple roles are present", () => {
            const onChainRoles =
                productRoles.campaignManager | productRoles.interactionManager;
            const role = productRoles.campaignManager;

            const result = repository.hasRoles({ onChainRoles, role });

            expect(result).toBe(true);
        });

        it("should return false when no roles are present", () => {
            const onChainRoles = 0n;
            const role = productRoles.campaignManager;

            const result = repository.hasRoles({ onChainRoles, role });

            expect(result).toBe(false);
        });

        it("should handle bitwise operations correctly", () => {
            const onChainRoles = 0b1010n; // Binary representation
            const role1 = 0b0010n;
            const role2 = 0b0100n;
            const role3 = 0b1000n;

            expect(repository.hasRoles({ onChainRoles, role: role1 })).toBe(
                true
            );
            expect(repository.hasRoles({ onChainRoles, role: role2 })).toBe(
                false
            );
            expect(repository.hasRoles({ onChainRoles, role: role3 })).toBe(
                true
            );
        });
    });

    describe("hasRolesOrAdmin", () => {
        it("should return true when has specific role", () => {
            const onChainRoles = productRoles.campaignManager;
            const role = productRoles.campaignManager;

            const result = repository.hasRolesOrAdmin({ onChainRoles, role });

            expect(result).toBe(true);
        });

        it("should return true when has admin role", () => {
            const onChainRoles = productRoles.productAdministrator;
            const role = productRoles.campaignManager;

            const result = repository.hasRolesOrAdmin({ onChainRoles, role });

            expect(result).toBe(true);
        });

        it("should return true when has both specific role and admin", () => {
            const onChainRoles =
                productRoles.campaignManager |
                productRoles.productAdministrator;
            const role = productRoles.campaignManager;

            const result = repository.hasRolesOrAdmin({ onChainRoles, role });

            expect(result).toBe(true);
        });

        it("should return false when has neither role nor admin", () => {
            const onChainRoles = productRoles.interactionManager;
            const role = productRoles.campaignManager;

            const result = repository.hasRolesOrAdmin({ onChainRoles, role });

            expect(result).toBe(false);
        });

        it("should return false when has no roles", () => {
            const onChainRoles = 0n;
            const role = productRoles.campaignManager;

            const result = repository.hasRolesOrAdmin({ onChainRoles, role });

            expect(result).toBe(false);
        });
    });

    describe("cache key generation", () => {
        it("should generate different cache keys for different wallets", async () => {
            const wallet2 =
                "0x9999999999999999999999999999999999999999" as Address;

            viemActionsMocks.multicall
                .mockResolvedValueOnce([mockOwner, 5n])
                .mockResolvedValueOnce([mockOwner, 5n]);

            await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            await repository.getRolesOnProduct({
                wallet: wallet2,
                productId: mockProductId,
            });

            // Should call multicall twice (different cache keys)
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(2);
        });

        it("should generate different cache keys for different products", async () => {
            const productId2 = 456n;

            viemActionsMocks.multicall
                .mockResolvedValueOnce([mockOwner, 5n])
                .mockResolvedValueOnce([mockOwner, 5n]);

            await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: mockProductId,
            });
            await repository.getRolesOnProduct({
                wallet: mockWallet,
                productId: productId2,
            });

            // Should call multicall twice (different cache keys)
            expect(viemActionsMocks.multicall).toHaveBeenCalledTimes(2);
        });
    });
});
