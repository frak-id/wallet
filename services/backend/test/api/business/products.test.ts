import { beforeEach, describe, expect, it, vi } from "vitest";
import { productRoutes } from "../../../src/api/business/routes/products";
import {
    JwtContextMock,
    dbMock,
    dnsCheckRepositoryMocks,
    mintRepositoryMocks,
    onChainRolesRepositoryMocks,
    resetMockBusinessSession,
    setMockBusinessSession,
} from "../../mock/common";

/**
 * Helper to create authenticated request headers
 */
function createAuthHeaders(): HeadersInit {
    return {
        "x-business-auth": "mock-business-jwt-token",
    };
}

describe("Business Product Routes API", () => {
    const mockWalletAddress =
        "0x1234567890123456789012345678901234567890" as const;
    const mockProductId =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
    const mockDomain = "example.com";

    beforeEach(() => {
        dbMock.__reset();
        onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockClear();
        resetMockBusinessSession();
        dnsCheckRepositoryMocks.getDnsTxtString.mockClear();
        dnsCheckRepositoryMocks.getNormalizedDomain.mockClear();
        dnsCheckRepositoryMocks.isValidDomain.mockClear();
        mintRepositoryMocks.precomputeProductId.mockClear();
        mintRepositoryMocks.isExistingProduct.mockClear();
        mintRepositoryMocks.mintProduct.mockClear();
        JwtContextMock.business.verify.mockClear();
    });

    /* -------------------------------------------------------------------------- */
    /*                              Mint Routes Tests                             */
    /* -------------------------------------------------------------------------- */

    describe("GET /mint/dnsTxt", () => {
        it("should return empty string when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            // Act: Make GET request without auth header
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/dnsTxt?domain=${mockDomain}`
                )
            );

            // Assert: Should return empty string
            expect(response.status).toBe(200);
            const text = await response.text();
            expect(text).toBe("");

            expect(
                dnsCheckRepositoryMocks.getDnsTxtString
            ).not.toHaveBeenCalled();
        });

        it("should return DNS TXT string when business session exists", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockDnsTxt = "frak-business; hash=0xabc123";
            dnsCheckRepositoryMocks.getDnsTxtString.mockReturnValue(mockDnsTxt);

            // Act: Make GET request with auth header
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/dnsTxt?domain=${mockDomain}`,
                    {
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return DNS TXT string
            expect(response.status).toBe(200);
            const text = await response.text();
            expect(text).toBe(mockDnsTxt);

            expect(
                dnsCheckRepositoryMocks.getDnsTxtString
            ).toHaveBeenCalledWith({
                domain: mockDomain,
                owner: mockWalletAddress,
            });
        });

        it("should return 422 when domain parameter is missing", async () => {
            // Arrange: Valid business session but no domain
            setMockBusinessSession({ wallet: mockWalletAddress });

            // Act: Make GET request without domain
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint/dnsTxt", {
                    headers: createAuthHeaders(),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });
    });

    describe("GET /mint/verify", () => {
        it("should return false for both checks when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/verify?domain=${mockDomain}`
                )
            );

            // Assert: Should return false for both
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                isDomainValid: false,
                isAlreadyMinted: false,
            });
        });

        it("should verify domain and check if product exists when business session exists", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            const precomputedId = BigInt(mockProductId);

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.precomputeProductId.mockReturnValue(
                precomputedId
            );
            mintRepositoryMocks.isExistingProduct.mockResolvedValue(false);

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/verify?domain=${mockDomain}`,
                    {
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return validation results
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                isDomainValid: true,
                isAlreadyMinted: false,
            });

            expect(
                dnsCheckRepositoryMocks.getNormalizedDomain
            ).toHaveBeenCalledWith(mockDomain);
            expect(dnsCheckRepositoryMocks.isValidDomain).toHaveBeenCalledWith({
                domain: normalizedDomain,
                owner: mockWalletAddress,
                setupCode: undefined,
            });
            expect(
                mintRepositoryMocks.precomputeProductId
            ).toHaveBeenCalledWith(normalizedDomain);
            expect(mintRepositoryMocks.isExistingProduct).toHaveBeenCalledWith(
                precomputedId
            );
        });

        it("should check with setupCode when provided", async () => {
            // Arrange: Valid business session with setup code
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            const setupCode = "0xabc123";

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.precomputeProductId.mockReturnValue(
                BigInt(mockProductId)
            );
            mintRepositoryMocks.isExistingProduct.mockResolvedValue(false);

            // Act: Make GET request with setupCode
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/verify?domain=${mockDomain}&setupCode=${setupCode}`,
                    {
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should pass setupCode to validation
            expect(response.status).toBe(200);
            expect(dnsCheckRepositoryMocks.isValidDomain).toHaveBeenCalledWith({
                domain: normalizedDomain,
                owner: mockWalletAddress,
                setupCode,
            });
        });

        it("should return true for isAlreadyMinted when product exists", async () => {
            // Arrange: Valid business session, product already minted
            setMockBusinessSession({ wallet: mockWalletAddress });

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                mockDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.precomputeProductId.mockReturnValue(
                BigInt(mockProductId)
            );
            mintRepositoryMocks.isExistingProduct.mockResolvedValue(true);

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/mint/verify?domain=${mockDomain}`,
                    {
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return isAlreadyMinted as true
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                isDomainValid: true,
                isAlreadyMinted: true,
            });
        });

        it("should return 422 when domain parameter is missing", async () => {
            // Arrange: Valid business session but no domain
            setMockBusinessSession({ wallet: mockWalletAddress });

            // Act: Make GET request without domain
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint/verify", {
                    headers: createAuthHeaders(),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });
    });

    describe("PUT /mint", () => {
        it("should return 401 when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Invalid session");
        });

        it("should return 400 when domain is invalid", async () => {
            // Arrange: Valid business session, invalid domain
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(false);

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 400
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                "The domain is invalid (either DNS TXT or invalid setup code)"
            );

            expect(dnsCheckRepositoryMocks.isValidDomain).toHaveBeenCalledWith({
                domain: normalizedDomain,
                owner: mockWalletAddress,
                setupCode: undefined,
            });
        });

        it("should successfully mint product when all validations pass", async () => {
            // Arrange: Valid business session, valid domain
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;
            const mockInteractionContract =
                "0x9999999999999999999999999999999999999999" as const;
            const mockBankContract =
                "0x8888888888888888888888888888888888888888" as const;

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.mintProduct.mockResolvedValue({
                mintTxHash: mockTxHash,
                productId: BigInt(mockProductId),
                interactionResult: {
                    txHash: mockTxHash,
                    interactionContract: mockInteractionContract,
                } as any,
                bankResult: {
                    txHash: mockTxHash,
                    bank: mockBankContract,
                } as any,
            });

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 200 with mint result
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                txHash: mockTxHash,
                productId: mockProductId,
                interactionContract: mockInteractionContract,
                bankContract: mockBankContract,
            });

            expect(mintRepositoryMocks.mintProduct).toHaveBeenCalledWith({
                name: "Test Product",
                domain: normalizedDomain,
                productTypes: ["press"],
                owner: mockWalletAddress,
                currency: "usdc",
            });
        });

        it("should handle mint error and return 400", async () => {
            // Arrange: Valid business session, mint fails
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.mintProduct.mockRejectedValue(
                new Error("Product already exists")
            );

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 400 with error message
            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Product already exists");
        });

        it("should validate required fields and return 422 when missing", async () => {
            // Arrange: Valid business session, missing required fields
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                name: "Test Product",
                // Missing domain, productTypes, currency
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should validate currency enum and return 422 for invalid value", async () => {
            // Arrange: Valid business session, invalid currency
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "invalid" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should handle setupCode parameter when provided", async () => {
            // Arrange: Valid business session with setup code
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            const setupCode = "0xabc123";
            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.mintProduct.mockResolvedValue({
                mintTxHash: mockTxHash,
                productId: BigInt(mockProductId),
                interactionResult: undefined,
                bankResult: undefined,
            });

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
                setupCode,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should use setupCode in validation
            expect(response.status).toBe(200);
            expect(dnsCheckRepositoryMocks.isValidDomain).toHaveBeenCalledWith({
                domain: normalizedDomain,
                owner: mockWalletAddress,
                setupCode,
            });
        });

        it("should handle mint result with no interaction or bank contracts", async () => {
            // Arrange: Valid business session, mint succeeds without optional contracts
            setMockBusinessSession({ wallet: mockWalletAddress });

            const normalizedDomain = "example.com";
            const mockTxHash =
                "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

            dnsCheckRepositoryMocks.getNormalizedDomain.mockReturnValue(
                normalizedDomain
            );
            dnsCheckRepositoryMocks.isValidDomain.mockResolvedValue(true);
            mintRepositoryMocks.mintProduct.mockResolvedValue({
                mintTxHash: mockTxHash,
                productId: BigInt(mockProductId),
                interactionResult: undefined,
                bankResult: undefined,
            });

            const requestBody = {
                name: "Test Product",
                domain: mockDomain,
                productTypes: ["press"],
                currency: "usdc" as const,
            };

            // Act: Make PUT request
            const response = await productRoutes.handle(
                new Request("http://localhost/product/mint", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return result with undefined optional contracts
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                txHash: mockTxHash,
                productId: mockProductId,
                interactionContract: undefined,
                bankContract: undefined,
            });
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                       Interaction Webhook Routes Tests                     */
    /* -------------------------------------------------------------------------- */

    describe("GET /interactionsWebhook/:productId/status", () => {
        it("should return 400 when productId is missing", async () => {
            // Act: Make GET request without productId
            const response = await productRoutes.handle(
                new Request(
                    "http://localhost/product//interactionsWebhook/status"
                )
            );

            // Assert: Should return 400 or 404
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it("should return setup false when no tracker exists", async () => {
            // Arrange: No tracker in database
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/status`
                )
            );

            // Assert: Should return setup false
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({ setup: false });
        });

        it("should return tracker status when tracker exists", async () => {
            // Arrange: Tracker exists
            const mockTracker = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "test-key-123",
                source: "custom" as const,
            };
            dbMock.__setSelectResponse(() => Promise.resolve([mockTracker]));

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/status`
                )
            );

            // Assert: Should return tracker status
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                setup: true,
                source: "custom",
                webhookSigninKey: "test-key-123",
            });
        });

        it("should return 422 when productId is not a valid hex", async () => {
            // Act: Make GET request with invalid hex
            const response = await productRoutes.handle(
                new Request(
                    "http://localhost/product/not-a-hex/interactionsWebhook/status"
                )
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });
    });

    describe("POST /interactionsWebhook/:productId/setup", () => {
        it("should return 401 when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            const requestBody = {
                hookSignatureKey: "test-key",
                source: "custom" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/setup`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 401 when user does not have required role", async () => {
            // Arrange: Valid business session, no permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                false
            );

            const requestBody = {
                hookSignatureKey: "test-key",
                source: "custom" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");

            expect(
                onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct
            ).toHaveBeenCalledWith({
                wallet: mockWalletAddress,
                productId: BigInt(mockProductId),
                role: expect.any(BigInt), // interactionManager role
            });
        });

        it("should setup tracker when user has required role", async () => {
            // Arrange: Valid business session with permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );

            const insertSpy = vi.fn(() => ({
                onConflictDoUpdate: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve()),
                })),
            }));
            const valuesSpy = vi.fn(() => ({
                onConflictDoUpdate: insertSpy().onConflictDoUpdate,
            }));
            dbMock.insert = vi.fn(() => ({ values: valuesSpy })) as never;

            const requestBody = {
                hookSignatureKey: "test-key-123",
                source: "custom" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(valuesSpy).toHaveBeenCalledWith({
                productId: mockProductId,
                hookSignatureKey: "test-key-123",
                source: "custom",
            });
        });

        it("should return 422 when required fields are missing", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                // Missing hookSignatureKey and source
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 400 when productId is missing from params", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                hookSignatureKey: "test-key",
                source: "custom" as const,
            };

            // Act: Make POST request without productId
            const response = await productRoutes.handle(
                new Request(
                    "http://localhost/product//interactionsWebhook/setup",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 400
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe("POST /interactionsWebhook/:productId/delete", () => {
        it("should return 401 when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/delete`,
                    { method: "POST" }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 401 when user does not have required role", async () => {
            // Arrange: Valid business session, no permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                false
            );

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 404 when tracker does not exist", async () => {
            // Arrange: Valid business session with permission, no tracker
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                `Product ${mockProductId} have no current tracker setup`
            );
        });

        it("should delete tracker when user has required role and tracker exists", async () => {
            // Arrange: Valid business session with permission, tracker exists
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );
            dbMock.__setSelectResponse(() =>
                Promise.resolve([{ id: 1, productId: mockProductId }])
            );

            const executeDeleteSpy = vi.fn(() => Promise.resolve());
            const whereSpy = vi.fn(() => ({
                execute: executeDeleteSpy,
            }));
            dbMock.delete = vi.fn(() => ({ where: whereSpy })) as never;

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/interactionsWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(whereSpy).toHaveBeenCalled();
            expect(executeDeleteSpy).toHaveBeenCalled();
        });
    });

    /* -------------------------------------------------------------------------- */
    /*                         Oracle Webhook Routes Tests                        */
    /* -------------------------------------------------------------------------- */

    describe("GET /oracleWebhook/:productId/status", () => {
        it("should return 400 when productId is missing", async () => {
            // Act: Make GET request without productId
            const response = await productRoutes.handle(
                new Request("http://localhost/product//oracleWebhook/status")
            );

            // Assert: Should return 400 or 404
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it("should return setup false when no oracle exists", async () => {
            // Arrange: No oracle in database
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/status`
                )
            );

            // Assert: Should return setup false
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({ setup: false });
        });

        it("should return oracle status without stats when no business session", async () => {
            // Arrange: Oracle exists, no business session
            setMockBusinessSession(null);

            const mockOracle = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "test-key-123",
                platform: "shopify" as const,
            };

            // Mock both queries: first for oracle, second for stats
            let callCount = 0;
            dbMock.__setSelectResponse(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve([mockOracle]);
                }
                // Second call is for stats
                return Promise.resolve([
                    {
                        firstPurchase: null,
                        lastPurchase: null,
                        lastUpdate: null,
                        totalPurchaseHandled: 0,
                    },
                ]);
            });

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/status`
                )
            );

            // Assert: Should return redacted key and no stats
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({
                setup: true,
                platform: "shopify",
                webhookSigninKey: "redacted",
                stats: undefined,
            });
        });

        it("should return oracle status with stats when business session exists", async () => {
            // Arrange: Oracle exists, business session present
            setMockBusinessSession({ wallet: mockWalletAddress });

            const mockOracle = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "test-key-123",
                platform: "shopify" as const,
            };
            const mockStats = {
                firstPurchase: new Date("2024-01-01"),
                lastPurchase: new Date("2024-01-10"),
                lastUpdate: new Date("2024-01-11"),
                totalPurchaseHandled: 42,
            };

            // Set up multiple select responses (first for oracle, second for stats)
            let callCount = 0;
            dbMock.__setSelectResponse(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve([mockOracle]);
                }
                return Promise.resolve([mockStats]);
            });

            // Act: Make GET request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/status`,
                    {
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return full key and stats
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.setup).toBe(true);
            expect(data.platform).toBe("shopify");
            expect(data.webhookSigninKey).toBe("test-key-123");
            expect(data.stats).toBeDefined();
        });

        it("should return 422 when productId is not a valid hex", async () => {
            // Act: Make GET request with invalid hex
            const response = await productRoutes.handle(
                new Request(
                    "http://localhost/product/not-a-hex/oracleWebhook/status"
                )
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });
    });

    describe("POST /oracleWebhook/:productId/setup", () => {
        it("should return 401 when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            const requestBody = {
                hookSignatureKey: "test-key",
                platform: "shopify" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 401 when user does not have required role", async () => {
            // Arrange: Valid business session, no permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                false
            );

            const requestBody = {
                hookSignatureKey: "test-key",
                platform: "shopify" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");

            expect(
                onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct
            ).toHaveBeenCalledWith({
                wallet: mockWalletAddress,
                productId: BigInt(mockProductId),
                role: expect.any(BigInt), // interactionManager role
            });
        });

        it("should setup oracle when user has required role", async () => {
            // Arrange: Valid business session with permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );

            const insertSpy = vi.fn(() => ({
                onConflictDoUpdate: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve()),
                })),
            }));
            const valuesSpy = vi.fn(() => ({
                onConflictDoUpdate: insertSpy().onConflictDoUpdate,
            }));
            dbMock.insert = vi.fn(() => ({ values: valuesSpy })) as never;

            const requestBody = {
                hookSignatureKey: "test-key-123",
                platform: "shopify" as const,
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(valuesSpy).toHaveBeenCalledWith({
                productId: mockProductId,
                hookSignatureKey: "test-key-123",
                platform: "shopify",
            });
        });

        it("should validate platform enum values", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );

            const validPlatforms = [
                "shopify",
                "woocommerce",
                "custom",
                "internal",
            ];

            for (const platform of validPlatforms) {
                const insertSpy = vi.fn(() => ({
                    onConflictDoUpdate: vi.fn(() => ({
                        execute: vi.fn(() => Promise.resolve()),
                    })),
                }));
                const valuesSpy = vi.fn(() => ({
                    onConflictDoUpdate: insertSpy().onConflictDoUpdate,
                }));
                dbMock.insert = vi.fn(() => ({ values: valuesSpy })) as never;

                const requestBody = {
                    hookSignatureKey: "test-key",
                    platform: platform as
                        | "shopify"
                        | "woocommerce"
                        | "custom"
                        | "internal",
                };

                // Act: Make POST request
                const response = await productRoutes.handle(
                    new Request(
                        `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...createAuthHeaders(),
                            },
                            body: JSON.stringify(requestBody),
                        }
                    )
                );

                // Assert: Should accept valid platform
                expect(response.status).toBe(200);
            }
        });

        it("should return 422 when platform is invalid", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                hookSignatureKey: "test-key",
                platform: "invalid-platform",
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 422 when required fields are missing", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                // Missing hookSignatureKey and platform
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/setup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...createAuthHeaders(),
                        },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            // Assert: Should return 422 validation error
            expect(response.status).toBe(422);
        });

        it("should return 400 when productId is missing from params", async () => {
            // Arrange: Valid business session
            setMockBusinessSession({ wallet: mockWalletAddress });

            const requestBody = {
                hookSignatureKey: "test-key",
                platform: "shopify" as const,
            };

            // Act: Make POST request without productId
            const response = await productRoutes.handle(
                new Request("http://localhost/product//oracleWebhook/setup", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...createAuthHeaders(),
                    },
                    body: JSON.stringify(requestBody),
                })
            );

            // Assert: Should return 400
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe("POST /oracleWebhook/:productId/delete", () => {
        it("should return 401 when no business session", async () => {
            // Arrange: No business session
            setMockBusinessSession(null);

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/delete`,
                    { method: "POST" }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 401 when user does not have required role", async () => {
            // Arrange: Valid business session, no permission
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                false
            );

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return 401
            expect(response.status).toBe(401);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Unauthorized");
        });

        it("should return 404 when oracle does not exist", async () => {
            // Arrange: Valid business session with permission, no oracle
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );

            // Mock db.query.productOracleTable.findFirst to return undefined
            (dbMock.query as any).productOracleTable = {
                findFirst: vi.fn(() => Promise.resolve(undefined)),
            };

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should return 404
            expect(response.status).toBe(404);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                `Product ${mockProductId} have no current oracle setup`
            );
        });

        it("should delete oracle when user has required role and oracle exists", async () => {
            // Arrange: Valid business session with permission, oracle exists
            setMockBusinessSession({ wallet: mockWalletAddress });
            onChainRolesRepositoryMocks.hasRoleOrAdminOnProduct.mockResolvedValue(
                true
            );

            // Mock db.query.productOracleTable.findFirst to return oracle
            (dbMock.query as any).productOracleTable = {
                findFirst: vi.fn(() =>
                    Promise.resolve({
                        id: 1,
                        productId: mockProductId,
                    })
                ),
            };

            const executeDeleteSpy = vi.fn(() => Promise.resolve());
            const whereSpy = vi.fn(() => ({
                execute: executeDeleteSpy,
            }));
            dbMock.delete = vi.fn(() => ({ where: whereSpy })) as never;

            // Act: Make POST request
            const response = await productRoutes.handle(
                new Request(
                    `http://localhost/product/${mockProductId}/oracleWebhook/delete`,
                    {
                        method: "POST",
                        headers: createAuthHeaders(),
                    }
                )
            );

            // Assert: Should succeed
            expect(response.status).toBe(200);
            expect(whereSpy).toHaveBeenCalled();
            expect(executeDeleteSpy).toHaveBeenCalled();
        });
    });
});
