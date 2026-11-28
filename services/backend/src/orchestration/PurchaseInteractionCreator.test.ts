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

            // PurchaseItemSelect shape: sku is `string | null`.
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

    describe("line total — the matched-items payout basis", () => {
        const withCreator = async (items: unknown[]) => {
            const { creator, interactionLogRepository } = buildCreator();
            vi.mocked(
                interactionLogRepository.createIdempotent
            ).mockResolvedValue({ id: "interaction-1" } as never);

            await creator.create({ ...baseParams, items: items as never });

            return vi.mocked(interactionLogRepository.createIdempotent).mock
                .calls[0]?.[0].payload as PurchasePayload;
        };

        it("pays on the discounted line total the provider sent, not the list price", async () => {
            const payload = await withCreator([
                {
                    externalId: "product-1",
                    name: "Shoe",
                    quantity: 1,
                    price: "100",
                    totalPrice: "70",
                },
            ]);

            expect(payload.items[0]?.totalPrice).toBe(70);
            expect(payload.items[0]?.unitPrice).toBe(100);
        });

        it("falls back to price * quantity for rows stored before line totals existed", async () => {
            const payload = await withCreator([
                {
                    externalId: "product-1",
                    name: "Shoe",
                    quantity: 3,
                    price: "10",
                    totalPrice: null,
                },
            ]);

            expect(payload.items[0]?.totalPrice).toBe(30);
        });

        it("falls back rather than emitting NaN when the stored total is unparseable", async () => {
            const payload = await withCreator([
                {
                    externalId: "product-1",
                    name: "Shoe",
                    quantity: 2,
                    price: "10",
                    totalPrice: "oops",
                },
            ]);

            expect(payload.items[0]?.totalPrice).toBe(20);
        });

        it("builds the same payload items from both claim paths", async () => {
            const webhookFirst = await withCreator([
                {
                    externalId: "product-1",
                    name: "Shoe",
                    quantity: 2,
                    price: "50",
                    totalPrice: "70",
                    sku: "A-S",
                },
            ]);
            const lateClaim = await withCreator([
                {
                    id: "row-1",
                    purchaseId: "purchase-1",
                    externalId: "product-1",
                    name: "Shoe",
                    title: "Shoe",
                    imageUrl: null,
                    createdAt: new Date(),
                    quantity: 2,
                    price: "50",
                    totalPrice: "70",
                    sku: "A-S",
                },
            ]);

            expect(lateClaim.items).toEqual(webhookFirst.items);
        });
    });
});

describe("PurchaseInteractionCreator subscription", () => {
    const create = async (
        subscription: Parameters<
            PurchaseInteractionCreator["create"]
        >[0]["subscription"]
    ) => {
        const { creator, interactionLogRepository } = buildCreator();
        vi.mocked(interactionLogRepository.createIdempotent).mockResolvedValue({
            id: "interaction-1",
        } as never);
        await creator.create({ ...baseParams, items: [], subscription });
        return vi.mocked(interactionLogRepository.createIdempotent).mock
            .calls[0]?.[0].payload as PurchasePayload;
    };

    it("marks the payload pending while the provider has not answered", async () => {
        const payload = await create({
            state: "pending",
            attempts: 0,
            nextAttemptAt: null,
        });

        expect(payload.subscription).toEqual({ state: "pending" });
    });

    it("copies a resolved renewal into the payload", async () => {
        const payload = await create({
            state: "resolved",
            attempts: 1,
            nextAttemptAt: null,
            kind: "renewal",
            providerSubscriptionIds: ["sub-1"],
            cyclesCovered: 1,
            merchandiseAmount: 20,
        });

        expect(payload.subscription).toMatchObject({
            kind: "renewal",
            counted: true,
        });
    });

    it("leaves an ordinary purchase without a subscription block", async () => {
        const payload = await create(null);

        expect(payload.subscription).toBeUndefined();
    });
});
