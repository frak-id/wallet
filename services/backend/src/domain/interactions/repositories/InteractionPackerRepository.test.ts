import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import { interactionDiamondRepositoryMocks } from "../../../../test/mock/common";
import { viemActionsMocks } from "../../../../test/mock/viem";
import { InteractionPackerRepository } from "./InteractionPackerRepository";

describe("InteractionPackerRepository", () => {
    let repository: InteractionPackerRepository;

    beforeEach(() => {
        repository = new InteractionPackerRepository();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("simulateInteraction", () => {
        const mockWallet =
            "0x1234567890123456789012345678901234567890" as Address;
        const mockProductId =
            "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
        const mockDiamondContract =
            "0x9876543210987654321098765432109876543210" as Address;

        it("should return failure when diamond contract not found", async () => {
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                undefined
            );

            const result = await repository.simulateInteraction({
                wallet: mockWallet,
                productId: mockProductId,
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123456" as Hex,
                },
            });

            expect(result.isSimulationSuccess).toBe(false);
            expect(result.failureReason).toBe(
                "No diamond contract found for product"
            );
        });

        it("should return success when simulation succeeds", async () => {
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondContract
            );

            // Mock simulateContract to succeed (not throw)
            viemActionsMocks.simulateContract.mockResolvedValue({
                result: undefined,
                request: {},
            });

            const result = await repository.simulateInteraction({
                wallet: mockWallet,
                productId: mockProductId,
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123456" as Hex,
                },
            });

            expect(result.isSimulationSuccess).toBe(true);
            expect(result.failureReason).toBeUndefined();
            expect(viemActionsMocks.simulateContract).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    account: mockWallet,
                    address: mockDiamondContract,
                    functionName: "delegateToFacet",
                })
            );
        });

        it("should return failure when simulation reverts", async () => {
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondContract
            );

            // Mock simulateContract to fail
            viemActionsMocks.simulateContract.mockRejectedValue(
                new Error("Simulation reverted")
            );

            const result = await repository.simulateInteraction({
                wallet: mockWallet,
                productId: mockProductId,
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123456" as Hex,
                },
            });

            expect(result.isSimulationSuccess).toBe(false);
            expect(result.failureReason).toBeUndefined();
        });

        it("should pass correct args to simulateContract", async () => {
            interactionDiamondRepositoryMocks.getDiamondContract.mockResolvedValue(
                mockDiamondContract
            );
            viemActionsMocks.simulateContract.mockResolvedValue({
                result: undefined,
                request: {},
            });

            const typeDenominator = "0x0a" as Hex;
            const interactionData = "0xdeadbeef" as Hex;

            await repository.simulateInteraction({
                wallet: mockWallet,
                productId: mockProductId,
                interactionData: {
                    handlerTypeDenominator: typeDenominator,
                    interactionData,
                },
            });

            expect(viemActionsMocks.simulateContract).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    account: mockWallet,
                    address: mockDiamondContract,
                    functionName: "delegateToFacet",
                    args: [
                        Number.parseInt(typeDenominator, 16),
                        interactionData,
                    ],
                })
            );
        });
    });

    describe("packageInteractionData", () => {
        it("should package interaction data correctly", () => {
            const interactionData = {
                handlerTypeDenominator: "0x05" as Hex,
                interactionData: "0xabcdef123456" as Hex,
            };
            const signature =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result = repository.packageInteractionData({
                interactionData,
                signature,
            });

            // Result should be a hex string
            expect(result).toMatch(/^0x[0-9a-f]+$/i);
            expect(result.length).toBeGreaterThan(10);
        });

        it("should handle different type denominators", () => {
            const signature =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result1 = repository.packageInteractionData({
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x123" as Hex,
                },
                signature,
            });

            const result2 = repository.packageInteractionData({
                interactionData: {
                    handlerTypeDenominator: "0xff" as Hex,
                    interactionData: "0x123" as Hex,
                },
                signature,
            });

            // Different type denominators should produce different results
            expect(result1).not.toBe(result2);
        });

        it("should handle different interaction data", () => {
            const signature =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12" as Hex;

            const result1 = repository.packageInteractionData({
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x111111" as Hex,
                },
                signature,
            });

            const result2 = repository.packageInteractionData({
                interactionData: {
                    handlerTypeDenominator: "0x01" as Hex,
                    interactionData: "0x222222" as Hex,
                },
                signature,
            });

            // Different interaction data should produce different results
            expect(result1).not.toBe(result2);
        });

        it("should handle different signatures", () => {
            const interactionData = {
                handlerTypeDenominator: "0x01" as Hex,
                interactionData: "0x123" as Hex,
            };

            const result1 = repository.packageInteractionData({
                interactionData,
                signature:
                    "0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111" as Hex,
            });

            const result2 = repository.packageInteractionData({
                interactionData,
                signature:
                    "0x2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222" as Hex,
            });

            // Different signatures should produce different results
            expect(result1).not.toBe(result2);
        });
    });
});
