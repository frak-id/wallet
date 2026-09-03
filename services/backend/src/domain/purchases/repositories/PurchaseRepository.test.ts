import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseItemsTable, purchasesTable } from "../db/schema";
import { PurchaseRepository } from "./PurchaseRepository";

// No live DB: chainable vi.fn() stand-ins for the Drizzle query builder.
// `mockTrxInsert` gets its table-dispatching implementation in beforeEach,
// where schema imports are available (vi.mock factories are hoisted above them).
// The purchases chain also captures the `set` block passed to
// `.onConflictDoUpdate(...)` so tests can assert on the upsert semantics.
const {
    mockTrxInsert,
    mockTrxDelete,
    mockTrxSelect,
    mockPurchaseValues,
    mockPurchaseReturning,
    mockItemsValues,
    mockItemsOnConflictDoUpdate,
    mockTrxUpdate,
    capturedItemsSetRef,
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
        mockTrxDelete: vi.fn(),
        mockTrxSelect: vi.fn(),
        mockPurchaseValues: vi.fn(),
        mockPurchaseReturning: vi.fn(),
        mockItemsValues: vi.fn(),
        mockItemsOnConflictDoUpdate: vi.fn(),
        mockTrxUpdate: vi.fn(),
        capturedItemsSetRef: { current: null as unknown },
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
            cb({
                insert: mockTrxInsert,
                update: mockTrxUpdate,
                delete: mockTrxDelete,
                select: mockTrxSelect,
            })
        ),
        update: (...args: unknown[]) => dbMock.update(...args),
        query: dbMock.query,
    },
}));
const pgDialect = new PgDialect();
const capturedBackfills: { set: unknown; where: unknown }[] = [];
const capturedDeletes: { where: unknown }[] = [];

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
            // purchaseItemsTable: .values().onConflictDoUpdate()
            const itemsChain = {
                values: mockItemsValues.mockImplementation(() => itemsChain),
                onConflictDoUpdate:
                    mockItemsOnConflictDoUpdate.mockImplementation(
                        async (args: any) => {
                            capturedItemsSetRef.current = args;
                        }
                    ),
            };
            return itemsChain;
        });
        mockPurchaseValues.mockReset();
        mockPurchaseReturning.mockReset();
        mockPurchaseReturning.mockResolvedValue([{ purchaseId: "purchase-1" }]);
        mockItemsValues.mockReset();
        mockItemsOnConflictDoUpdate.mockReset();
        capturedItemsSetRef.current = null;
        mockTrxUpdate.mockReset();
        mockTrxUpdate.mockImplementation(() => ({
            set: vi.fn((set: unknown) => ({
                where: vi.fn(async (where: unknown) => {
                    capturedBackfills.push({ set, where });
                }),
            })),
        }));
        capturedBackfills.length = 0;
        mockTrxDelete.mockReset();
        mockTrxDelete.mockImplementation(() => ({
            where: vi.fn(async (where: unknown) => {
                capturedDeletes.push({ where });
            }),
        }));
        capturedDeletes.length = 0;
        mockTrxSelect.mockReset();
        mockTrxSelect.mockImplementation(() => ({
            from: vi.fn(() => ({ where: vi.fn((w: unknown) => w) })),
        }));
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

        const item = (overrides: Record<string, unknown>) => ({
            externalId: "product-1",
            price: "10.00",
            name: "Shoe",
            title: "Shoe",
            quantity: 1,
            ...overrides,
        });

        it("persists two variants of one product as separate rows", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [
                    item({ sku: "A-S" }) as never,
                    item({ sku: "A-M" }) as never,
                ],
            });

            const inserted = mockItemsValues.mock.calls[0]?.[0];
            expect(inserted).toHaveLength(2);
            expect(inserted.map((row: any) => row.sku)).toEqual(["A-S", "A-M"]);
        });

        it("binds the insert to the single nulls-not-distinct line key", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({ sku: "A-S" }) as never, item({}) as never],
            });

            expect(mockItemsValues).toHaveBeenCalledTimes(1);
            const args = capturedItemsSetRef.current;
            expect(args.target).toEqual([
                purchaseItemsTable.purchaseId,
                purchaseItemsTable.externalId,
                purchaseItemsTable.sku,
            ]);
            expect(args.targetWhere).toBeUndefined();
        });

        it("adopts a stored sku-less row instead of inserting a duplicate when a redelivery adds the sku", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({ sku: "A-S" }) as never],
            });

            expect(capturedBackfills).toHaveLength(1);
            expect(capturedBackfills[0]?.set).toEqual({ sku: "A-S" });
            expect(pgDialect.sqlToQuery(capturedBackfills[0]?.where).sql).toBe(
                '("purchase_items"."purchase_id" = $1 and "purchase_items"."external_id" = $2 and "purchase_items"."sku" is null and not exists ("taken"."purchase_id" = $3 and "taken"."external_id" = $4 and "taken"."sku" = $5))'
            );
        });

        it("does not adopt onto a line key that already exists", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({ sku: "A-S" }) as never],
            });

            // Without the guard this UPDATE moves the stored NULL row onto an
            // existing (purchase, product, sku) and violates the line index.
            const rendered = pgDialect.sqlToQuery(capturedBackfills[0]?.where);
            expect(rendered.sql).toContain("not exists");
            expect(rendered.params).toEqual([
                "purchase-1",
                "product-1",
                "purchase-1",
                "product-1",
                "A-S",
            ]);
        });

        it("deletes stored lines the delivery no longer carries", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({ sku: "A-M" }) as never],
            });

            expect(capturedDeletes).toHaveLength(1);
            const rendered = pgDialect.sqlToQuery(capturedDeletes[0]?.where);
            // `is not distinct from` and not `=`: a stored NULL sku compared
            // with `= $n` yields NULL, and DELETE only removes rows on TRUE.
            expect(rendered.sql).toBe(
                '("purchase_items"."purchase_id" = $1 and not ("purchase_items"."external_id" = $2 and "purchase_items"."sku" is not distinct from $3))'
            );
            expect(rendered.params).toEqual(["purchase-1", "product-1", "A-M"]);
        });

        it("keeps a sku-less line the delivery still carries", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({}) as never],
            });

            const rendered = pgDialect.sqlToQuery(capturedDeletes[0]?.where);
            expect(rendered.params).toEqual(["purchase-1", "product-1", null]);
        });

        it("reconciles every stored line when the product has several incoming lines", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [
                    item({ sku: "A-S" }) as never,
                    item({ sku: "A-M" }) as never,
                ],
            });

            // The backfill deliberately skips this shape, so the orphan
            // sku-less row is only removed by the reconciliation.
            expect(capturedBackfills).toHaveLength(0);
            const rendered = pgDialect.sqlToQuery(capturedDeletes[0]?.where);
            expect(rendered.params).toEqual([
                "purchase-1",
                "product-1",
                "A-S",
                "product-1",
                "A-M",
            ]);
        });

        it("does not delete stored lines when the delivery carries none", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [],
            });

            // `items` is optional on the custom and Magento webhooks; an empty
            // delivery must not wipe the order's lines.
            expect(capturedDeletes).toHaveLength(0);
        });

        it("leaves stored sku-less rows alone when the product has several incoming lines", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [
                    item({ sku: "A-S" }) as never,
                    item({ sku: "A-M" }) as never,
                ],
            });

            expect(capturedBackfills).toHaveLength(0);
        });

        it("merges lines sharing a product id and sku, summing quantity and line total", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [
                    item({
                        sku: "A-S",
                        quantity: 1,
                        totalPrice: "10",
                    }) as never,
                    item({
                        sku: "A-S",
                        quantity: 2,
                        totalPrice: "20",
                    }) as never,
                ],
            });

            // Two rows on one arbiter key would make Postgres reject the whole
            // statement; dropping the second is the truncation being fixed.
            const inserted = mockItemsValues.mock.calls[0]?.[0];
            expect(inserted).toHaveLength(1);
            expect(inserted[0].quantity).toBe(3);
            expect(inserted[0].totalPrice).toBe("30");
        });

        it("backfills totalPrice and imageUrl on redelivery without nulling stored values", async () => {
            await new PurchaseRepository().upsertWithItems({
                purchase: basePurchase as never,
                items: [item({ sku: "A-S" }) as never],
            });

            const set = capturedItemsSetRef.current.set;
            // `excluded` is the incoming row, the qualified column the stored
            // one: a redelivery fills a gap and never overwrites with NULL.
            expect(pgDialect.sqlToQuery(set.totalPrice).sql).toBe(
                'coalesce(excluded.total_price, "purchase_items"."total_price")'
            );
            expect(pgDialect.sqlToQuery(set.imageUrl).sql).toBe(
                'coalesce(excluded.image_url, "purchase_items"."image_url")'
            );
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
