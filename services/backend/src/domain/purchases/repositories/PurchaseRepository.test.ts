import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchasesTable } from "../db/schema";
import { PurchaseRepository } from "./PurchaseRepository";

// No live DB: chainable vi.fn() stand-ins for the Drizzle query builder.
// `mockTrxInsert` gets its table-dispatching implementation in beforeEach,
// where schema imports are available (vi.mock factories are hoisted above them).
// The purchases chain also captures the `set` block passed to
// `.onConflictDoUpdate(...)` so tests can assert on the upsert semantics.
const {
    mockTrxInsert,
    mockPurchaseValues,
    mockPurchaseReturning,
    mockItemsValues,
    mockItemsOnConflictDoNothing,
    mockSelectWhere,
    capturedSetRef,
    dbMock,
    getCapturedSet,
    getCapturedWhere,
    setUpdateResponse,
    setStoredGroupId,
} = vi.hoisted(() => {
    let capturedSet: unknown = null;
    let capturedWhere: unknown = null;
    let updateResponse: unknown[] = [];
    let storedGroupId: string | null = null;

    const dbMock = {
        update: vi.fn(() => ({
            set: vi.fn((set: unknown) => {
                capturedSet = set;
                return {
                    where: vi.fn((where: unknown) => {
                        capturedWhere = where;
                        return {
                            returning: vi.fn(async () => updateResponse),
                        };
                    }),
                };
            }),
        })),
        query: {
            purchasesTable: {
                findFirst: vi.fn(async () => ({
                    identityGroupId: storedGroupId,
                })),
            },
        },
    };

    return {
        mockTrxInsert: vi.fn(),
        mockPurchaseValues: vi.fn(),
        mockPurchaseReturning: vi.fn(),
        mockItemsValues: vi.fn(),
        mockItemsOnConflictDoNothing: vi.fn(),
        mockSelectWhere: vi.fn(),
        capturedSetRef: { current: null as unknown },
        dbMock,
        getCapturedSet: () => capturedSet,
        getCapturedWhere: () => capturedWhere,
        setUpdateResponse: (rows: unknown[]) => {
            updateResponse = rows;
        },
        setStoredGroupId: (groupId: string | null) => {
            storedGroupId = groupId;
        },
    };
});

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: mockSelectWhere,
        transaction: vi.fn(async (cb: (trx: unknown) => unknown) =>
            cb({ insert: mockTrxInsert })
        ),
        update: (...args: unknown[]) => dbMock.update(...args),
        query: dbMock.query,
    },
}));
const pgDialect = new PgDialect();

const basePurchase = {
    externalId: "order-1",
    webhookId: 1,
    externalCustomerId: "cust-1",
    totalPrice: "42.00",
    currencyCode: "USD",
    status: "paid" as const,
};

describe("PurchaseRepository", () => {
    beforeEach(() => {
        mockTrxInsert.mockReset();
        mockTrxInsert.mockImplementation((table: unknown) => {
            if (table === purchasesTable) {
                // purchasesTable: .values().onConflictDoUpdate().returning()
                const purchaseChain = {
                    values: mockPurchaseValues.mockImplementation(
                        () => purchaseChain
                    ),
                    onConflictDoUpdate: vi.fn((args: any) => {
                        capturedSetRef.current = args.set;
                        return purchaseChain;
                    }),
                    returning: mockPurchaseReturning,
                };
                return purchaseChain;
            }
            // purchaseItemsTable: .values().onConflictDoNothing()
            const itemsChain = {
                values: mockItemsValues.mockImplementation(() => itemsChain),
                onConflictDoNothing: mockItemsOnConflictDoNothing,
            };
            return itemsChain;
        });
        mockPurchaseValues.mockReset();
        mockPurchaseReturning.mockReset();
        mockPurchaseReturning.mockResolvedValue([{ purchaseId: "purchase-1" }]);
        mockItemsValues.mockReset();
        mockItemsOnConflictDoNothing.mockReset();
        mockItemsOnConflictDoNothing.mockResolvedValue(undefined);
        mockSelectWhere.mockReset();
        mockSelectWhere.mockResolvedValue([]);
        capturedSetRef.current = null;
    });

    describe("upsertWithItems — identityGroupId attribution", () => {
        it("fills identityGroupId via SQL COALESCE when the caller supplies one (first-writer-wins, not a JS check)", async () => {
            const repo = new PurchaseRepository();
            const newGroupId = "22222222-2222-2222-2222-222222222222";

            await repo.upsertWithItems({
                purchase: basePurchase,
                items: [],
                identityGroupId: newGroupId,
            });

            const set = capturedSetRef.current;
            expect(set.identityGroupId).toBeDefined();

            // Render the actual SQL: the bare column must resolve to the
            // existing row (not "excluded") with the supplied value as fallback,
            // so a redelivery can't clobber an already-set attribution.
            const rendered = pgDialect.sqlToQuery(set.identityGroupId);
            expect(rendered.sql).toBe(
                'coalesce("purchases"."identity_group_id", $1)'
            );
            expect(rendered.params).toEqual([newGroupId]);
        });

        it("never nulls out an existing group when the delivery supplies none", async () => {
            const repo = new PurchaseRepository();

            await repo.upsertWithItems({
                purchase: basePurchase,
                items: [],
            });

            const set = capturedSetRef.current;
            // Absent entirely, not undefined/null: only an absent key leaves
            // the column untouched in the SET clause.
            expect("identityGroupId" in set).toBe(false);
        });

        it("still updates status, totalPrice, currencyCode, updatedAt and purchaseToken (guard does not freeze the rest of the row)", async () => {
            const repo = new PurchaseRepository();

            await repo.upsertWithItems({
                purchase: {
                    ...basePurchase,
                    status: "refunded" as const,
                    totalPrice: "50.00",
                    currencyCode: "EUR",
                    purchaseToken: "tok-123",
                },
                items: [],
                identityGroupId: "33333333-3333-3333-3333-333333333333",
            });

            const set = capturedSetRef.current;
            expect(set.status).toBe("refunded");
            expect(set.totalPrice).toBe("50.00");
            expect(set.currencyCode).toBe("EUR");
            expect(set.purchaseToken).toBe("tok-123");
            expect(set.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe("upsertWithItems — items", () => {
        it("passes sku through into the inserted item values", async () => {
            const repository = new PurchaseRepository();

            await repository.upsertWithItems({
                purchase: {
                    externalId: "order-1",
                    webhookId: 1,
                    status: "paid",
                    totalPrice: "10.00",
                    currencyCode: "usd",
                } as never,
                items: [
                    {
                        externalId: "item-1",
                        price: "10.00",
                        name: "Widget",
                        title: "Widget",
                        quantity: 1,
                        sku: "SKU-123",
                    } as never,
                ],
            });

            expect(mockItemsValues).toHaveBeenCalledWith([
                expect.objectContaining({
                    sku: "SKU-123",
                    purchaseId: "purchase-1",
                }),
            ]);
        });

        it("does not insert items when the list is empty", async () => {
            const repository = new PurchaseRepository();

            await repository.upsertWithItems({
                purchase: {
                    externalId: "order-1",
                    webhookId: 1,
                    status: "paid",
                    totalPrice: "10.00",
                    currencyCode: "usd",
                } as never,
                items: [],
            });

            expect(mockItemsValues).not.toHaveBeenCalled();
        });
    });

    describe("findItemsByPurchaseId", () => {
        it("projects every column via a bare select (sku not stripped)", async () => {
            mockSelectWhere.mockResolvedValue([
                {
                    id: "item-1",
                    purchaseId: "purchase-1",
                    externalId: "ext-1",
                    price: "10.00",
                    name: "Widget",
                    title: "Widget",
                    imageUrl: null,
                    quantity: 1,
                    sku: "SKU-123",
                    createdAt: new Date(),
                },
            ]);

            const repository = new PurchaseRepository();
            const items = await repository.findItemsByPurchaseId("purchase-1");

            expect(items).toHaveLength(1);
            expect(items[0]?.sku).toBe("SKU-123");
        });
    });
});

describe("PurchaseRepository.updateIdentityGroup — compare-and-swap", () => {
    const PURCHASE_ID = "44444444-4444-4444-4444-444444444444";
    const NEW_GROUP = "55555555-5555-5555-5555-555555555555";

    it("swaps on IS NULL when the caller observed no attribution", async () => {
        setUpdateResponse([{ identityGroupId: NEW_GROUP }]);

        const result = await new PurchaseRepository().updateIdentityGroup(
            PURCHASE_ID,
            NEW_GROUP,
            null
        );

        expect(result).toBe(NEW_GROUP);
        // The NULL guard has to be in the SQL, not a JS pre-check: two
        // concurrent unauthenticated claims both observe NULL, so only the DB
        // can arbitrate which one lands.
        const rendered = pgDialect.sqlToQuery(getCapturedWhere());
        expect(rendered.sql).toContain('"identity_group_id" is null');
        expect(rendered.params).toContain(PURCHASE_ID);
    });

    it("swaps on the observed group id when superseding a merged attribution", async () => {
        const observed = "66666666-6666-6666-6666-666666666666";
        setUpdateResponse([{ identityGroupId: NEW_GROUP }]);

        await new PurchaseRepository().updateIdentityGroup(
            PURCHASE_ID,
            NEW_GROUP,
            observed
        );

        const rendered = pgDialect.sqlToQuery(getCapturedWhere());
        expect(rendered.sql).toContain('"identity_group_id" = ');
        expect(rendered.params).toEqual([PURCHASE_ID, observed]);
        expect(getCapturedSet().identityGroupId).toBe(NEW_GROUP);
    });

    it("returns the winner's group when the swap loses the race", async () => {
        const winner = "77777777-7777-7777-7777-777777777777";
        setUpdateResponse([]);
        setStoredGroupId(winner);

        const result = await new PurchaseRepository().updateIdentityGroup(
            PURCHASE_ID,
            NEW_GROUP,
            null
        );

        expect(result).toBe(winner);
    });
});
