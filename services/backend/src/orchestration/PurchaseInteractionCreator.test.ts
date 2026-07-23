import { describe, expect, it, vi } from "vitest";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchasePayload } from "../domain/rewards/types";
import { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    eventEmitter: {
        emit: vi.fn(),
    },
}));

const buildCreator = () => {
    const interactionLogRepository = {
        createIdempotent: vi.fn(),
    } as unknown as InteractionLogRepository;

    const creator = new PurchaseInteractionCreator(interactionLogRepository);

    return { creator, interactionLogRepository };
};

const baseParams = {
    purchaseId: "purchase-1",
    externalId: "order-1",
    externalCustomerId: "customer-1",
    totalPrice: "100",
    currencyCode: "EUR",
    identityGroupId: "identity-1",
    merchantId: "merchant-1",
};

describe("PurchaseInteractionCreator", () => {
    describe("sku plumbing", () => {
        it("carries sku from webhook-shaped items into the purchase payload", async () => {
            const { creator, interactionLogRepository } = buildCreator();
            vi.mocked(
                interactionLogRepository.createIdempotent
            ).mockResolvedValue({
                id: "interaction-1",
            } as never);

            await creator.create({
                ...baseParams,
                items: [
                    {
                        externalId: "product-1",
                        name: "Eco bottle",
                        quantity: 2,
                        price: "10",
                        sku: "SKU_ABC",
                    },
                ],
            });

            expect(
                interactionLogRepository.createIdempotent
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        items: [
                            expect.objectContaining({
                                productId: "product-1",
                                name: "Eco bottle",
                                sku: "SKU_ABC",
                            }),
                        ],
                    }),
                })
            );
        });

        it("carries sku from repository-shaped items (late-claim path, nullable sku)", async () => {
            const { creator, interactionLogRepository } = buildCreator();
            vi.mocked(
                interactionLogRepository.createIdempotent
            ).mockResolvedValue({
                id: "interaction-1",
            } as never);

            // Shape returned by PurchaseRepository.findItemsByPurchaseId
            // (PurchaseItemSelect): sku is `string | null`, not `string | undefined`.
            await creator.create({
                ...baseParams,
                items: [
                    {
                        externalId: "product-1",
                        name: "Eco bottle",
                        quantity: 1,
                        price: "10",
                        sku: null,
                    },
                ],
            });

            const payload = vi.mocked(interactionLogRepository.createIdempotent)
                .mock.calls[0]?.[0].payload as PurchasePayload;
            expect(payload.items[0]?.sku).toBeUndefined();
        });

        it("leaves sku undefined when the item carries no sku at all", async () => {
            const { creator, interactionLogRepository } = buildCreator();
            vi.mocked(
                interactionLogRepository.createIdempotent
            ).mockResolvedValue({
                id: "interaction-1",
            } as never);

            await creator.create({
                ...baseParams,
                items: [
                    {
                        externalId: "product-1",
                        name: "Eco bottle",
                        quantity: 1,
                        price: "10",
                    },
                ],
            });

            const payload = vi.mocked(interactionLogRepository.createIdempotent)
                .mock.calls[0]?.[0].payload as PurchasePayload;
            expect(payload.items[0]?.sku).toBeUndefined();
        });
    });
});
