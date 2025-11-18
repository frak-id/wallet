import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createBusinessSessionContextMock,
    onChainRolesRepositoryMocks,
} from "../../mock/common";

const testMocks = vi.hoisted(() => ({
    unsealDataMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("iron-session", () => ({
    unsealData: testMocks.unsealDataMock,
}));

vi.mock("../../../src/api/business/middleware/session", () => ({
    businessSessionContext: createBusinessSessionContextMock(
        testMocks.unsealDataMock
    ),
}));

import { rolesRoutes } from "../../../src/api/business/routes/roles";

function setMockBusinessSession(
    session: { wallet: `0x${string}` } | null
): void {
    if (session === null) {
        testMocks.unsealDataMock.mockResolvedValue(undefined);
    } else {
        testMocks.unsealDataMock.mockResolvedValue(session);
    }
}

function resetMockBusinessSession(): void {
    testMocks.unsealDataMock.mockReset();
    testMocks.unsealDataMock.mockResolvedValue(undefined);
}

describe("Business Roles Routes API", () => {
    const mockWalletAddress =
        "0x1234567890123456789012345678901234567890" as const;
    const mockProductId = "0x1" as const;

    beforeEach(() => {
        // Reset all mocks before each test
        onChainRolesRepositoryMocks.getRolesOnProduct.mockClear();
        onChainRolesRepositoryMocks.hasRolesOrAdmin.mockClear();
        resetMockBusinessSession();
    });

    describe("GET /roles", () => {
        it("should return 401 when businessSession is missing", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return 401 Unauthorized
            expect(response.status).toBe(401);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");

            expect(
                onChainRolesRepositoryMocks.getRolesOnProduct
            ).not.toHaveBeenCalled();
        });

        it("should return 400 when productId is missing", async () => {
            // Arrange: Valid business session but no productId
            setMockBusinessSession({ wallet: mockWalletAddress });

            // Act: Make GET request without productId
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return 400 Bad Request
            expect(response.status).toBe(400);

            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid product id");

            expect(
                onChainRolesRepositoryMocks.getRolesOnProduct
            ).not.toHaveBeenCalled();
        });

        it("should use businessSession.wallet when wallet param is not provided", async () => {
            // Arrange: Valid business session, mock repository response
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockRoles = {
                isOwner: false,
                roles: 0n,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request without wallet param
            const response = await rolesRoutes.handle(
                new Request(`http://localhost/roles?productId=${mockProductId}`)
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(
                onChainRolesRepositoryMocks.getRolesOnProduct
            ).toHaveBeenCalledWith({
                wallet: mockWalletAddress,
                productId: BigInt(mockProductId),
            });

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x0",
                isAdministrator: false,
                isInteractionManager: false,
                isCampaignManager: false,
            });
        });

        it("should return roles when isOwner is true", async () => {
            // Arrange: Valid business session, mock repository response with owner
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockRoles = {
                isOwner: true,
                roles: 0n, // No specific roles, but is owner
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return all roles as true because isOwner
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: true,
                roles: "0x0",
                isAdministrator: true, // true because isOwner
                isInteractionManager: true, // true because isOwner
                isCampaignManager: true, // true because isOwner
            });
        });

        it("should return roles with productAdministrator role", async () => {
            // Arrange: Valid business session, mock repository response with admin role
            setMockBusinessSession({ wallet: mockWalletAddress });

            const productAdministrator = BigInt(1 << 0); // 0x1
            const mockRoles = {
                isOwner: false,
                roles: productAdministrator,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            // Mock hasRolesOrAdmin to return true for admin checks
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockImplementation(
                ({ onChainRoles, role }) => {
                    const productAdministratorRole = BigInt(1 << 0);
                    return (
                        (onChainRoles & (role | productAdministratorRole)) !==
                        0n
                    );
                }
            );

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return all roles as true because of admin role
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x1",
                isAdministrator: true, // true because has admin role
                isInteractionManager: true, // true because admin has all roles
                isCampaignManager: true, // true because admin has all roles
            });
        });

        it("should return roles with interactionManager role only", async () => {
            // Arrange: Valid business session, mock repository response with interaction manager role
            setMockBusinessSession({ wallet: mockWalletAddress });

            const interactionManager = BigInt(1 << 1); // 0x2
            const mockRoles = {
                isOwner: false,
                roles: interactionManager,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            // Mock hasRolesOrAdmin to check role bits
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockImplementation(
                ({ onChainRoles, role }) => {
                    const productAdministratorRole = BigInt(1 << 0);
                    return (
                        (onChainRoles & (role | productAdministratorRole)) !==
                        0n
                    );
                }
            );

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return only interaction manager as true
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x2",
                isAdministrator: false, // false, no admin role
                isInteractionManager: true, // true, has interaction manager role
                isCampaignManager: false, // false, no campaign manager role
            });
        });

        it("should return roles with campaignManager role only", async () => {
            // Arrange: Valid business session, mock repository response with campaign manager role
            setMockBusinessSession({ wallet: mockWalletAddress });

            const campaignManager = BigInt(1 << 2); // 0x4
            const mockRoles = {
                isOwner: false,
                roles: campaignManager,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            // Mock hasRolesOrAdmin to check role bits
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockImplementation(
                ({ onChainRoles, role }) => {
                    const productAdministratorRole = BigInt(1 << 0);
                    return (
                        (onChainRoles & (role | productAdministratorRole)) !==
                        0n
                    );
                }
            );

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return only campaign manager as true
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x4",
                isAdministrator: false, // false, no admin role
                isInteractionManager: false, // false, no interaction manager role
                isCampaignManager: true, // true, has campaign manager role
            });
        });

        it("should return roles with multiple roles combined", async () => {
            // Arrange: Valid business session, mock repository response with multiple roles
            setMockBusinessSession({ wallet: mockWalletAddress });

            const interactionManager = BigInt(1 << 1); // 0x2
            const campaignManager = BigInt(1 << 2); // 0x4
            const combinedRoles = interactionManager | campaignManager; // 0x6
            const mockRoles = {
                isOwner: false,
                roles: combinedRoles,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            // Mock hasRolesOrAdmin to check role bits
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockImplementation(
                ({ onChainRoles, role }) => {
                    const productAdministratorRole = BigInt(1 << 0);
                    return (
                        (onChainRoles & (role | productAdministratorRole)) !==
                        0n
                    );
                }
            );

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return both interaction and campaign manager as true
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x6",
                isAdministrator: false, // false, no admin role
                isInteractionManager: true, // true, has interaction manager role
                isCampaignManager: true, // true, has campaign manager role
            });
        });

        it("should return no roles when user has no roles", async () => {
            // Arrange: Valid business session, mock repository response with no roles
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockRoles = {
                isOwner: false,
                roles: 0n,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return all roles as false
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                isOwner: false,
                roles: "0x0",
                isAdministrator: false,
                isInteractionManager: false,
                isCampaignManager: false,
            });
        });

        it("should use provided wallet parameter instead of session wallet", async () => {
            // Arrange: Valid business session with different wallet in query
            setMockBusinessSession({
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const,
            });
            const queryWallet =
                "0x9999999999999999999999999999999999999999" as const;

            const mockRoles = {
                isOwner: false,
                roles: 0n,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request with explicit wallet param
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${queryWallet}`
                )
            );

            // Assert: Should use query wallet, not session wallet
            expect(response.status).toBe(200);
            expect(
                onChainRolesRepositoryMocks.getRolesOnProduct
            ).toHaveBeenCalledWith({
                wallet: queryWallet,
                productId: BigInt(mockProductId),
            });
        });

        it("should handle large productId values", async () => {
            // Arrange: Valid business session, large productId
            setMockBusinessSession({ wallet: mockWalletAddress });
            const largeProductId =
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

            const mockRoles = {
                isOwner: false,
                roles: 0n,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request with large productId
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${largeProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should handle large values correctly
            expect(response.status).toBe(200);
            expect(
                onChainRolesRepositoryMocks.getRolesOnProduct
            ).toHaveBeenCalledWith({
                wallet: mockWalletAddress,
                productId: BigInt(largeProductId),
            });
        });

        it("should verify hasRolesOrAdmin is called for each role type", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockRoles = {
                isOwner: false,
                roles: 0n,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockReturnValue(false);

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should call hasRolesOrAdmin for each role type (3 times)
            expect(response.status).toBe(200);
            expect(
                onChainRolesRepositoryMocks.hasRolesOrAdmin
            ).toHaveBeenCalledTimes(3);

            // Verify it was called with correct role values
            const calls =
                onChainRolesRepositoryMocks.hasRolesOrAdmin.mock.calls;
            expect(calls[0][0]).toEqual({
                onChainRoles: 0n,
                role: BigInt(1 << 0), // productAdministrator
            });
            expect(calls[1][0]).toEqual({
                onChainRoles: 0n,
                role: BigInt(1 << 1), // interactionManager
            });
            expect(calls[2][0]).toEqual({
                onChainRoles: 0n,
                role: BigInt(1 << 2), // campaignManager
            });
        });

        it("should correctly convert roles bigint to hex string", async () => {
            // Arrange: Valid business session, mock repository response with all roles
            setMockBusinessSession({ wallet: mockWalletAddress });

            const allRoles = BigInt((1 << 0) | (1 << 1) | (1 << 2)); // 0x7
            const mockRoles = {
                isOwner: false,
                roles: allRoles,
            };
            onChainRolesRepositoryMocks.getRolesOnProduct.mockResolvedValue(
                mockRoles as never
            );
            onChainRolesRepositoryMocks.hasRolesOrAdmin.mockImplementation(
                ({ onChainRoles, role }) => {
                    const productAdministratorRole = BigInt(1 << 0);
                    return (
                        (onChainRoles & (role | productAdministratorRole)) !==
                        0n
                    );
                }
            );

            // Act: Make GET request
            const response = await rolesRoutes.handle(
                new Request(
                    `http://localhost/roles?productId=${mockProductId}&wallet=${mockWalletAddress}`
                )
            );

            // Assert: Should return correct hex representation
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.roles).toBe("0x7");
        });
    });
});
