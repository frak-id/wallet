import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { PurchaseRepository } from "./PurchaseRepository";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    get db() {
        return dbMock;
    },
}));

/**
 * Captures the `set`/`where` blocks Drizzle receives so tests can assert on
 * the exact SQL semantics `upsertWithItems` and `updateIdentityGroup`
 * generate, without needing a live Postgres instance (matches this codebase's
 * mocked-db repository test convention, e.g. `ReferralLinkRepository.test.ts`).
 */
const {
    dbMock,
    getCapturedSet,
    getCapturedWhere,
    setUpdateResponse,
    setStoredGroupId,
} = vi.hoisted(() => {
    let capturedSet: any = null;
    let capturedWhere: any = null;
    let updateResponse: unknown[] = [];
    let storedGroupId: string | null = null;

    const returningMock = vi
        .fn()
        .mockResolvedValue([{ purchaseId: "purchase-1" }]);
    const onConflictDoUpdateMock = vi.fn((args: any) => {
        capturedSet = args.set;
        return { returning: returningMock };
    });
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn(() => ({
        onConflictDoUpdate: onConflictDoUpdateMock,
        onConflictDoNothing: onConflictDoNothingMock,
    }));
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    const trx = { insert: insertMock };

    const dbMock = {
        transaction: vi.fn(async (fn: (trx: any) => Promise<unknown>) =>
            fn(trx)
        ),
        update: vi.fn(() => ({
            set: vi.fn((set: any) => {
                capturedSet = set;
                return {
                    where: vi.fn((where: any) => {
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

const pgDialect = new PgDialect();

const basePurchase = {
    externalId: "order-1",
    webhookId: 1,
    externalCustomerId: "cust-1",
    totalPrice: "42.00",
    currencyCode: "USD",
    status: "paid" as const,
};

describe("PurchaseRepository.upsertWithItems — identityGroupId attribution", () => {
    it("fills identityGroupId via SQL COALESCE when the caller supplies one (first-writer-wins, not a JS check)", async () => {
        const repo = new PurchaseRepository();
        const newGroupId = "22222222-2222-2222-2222-222222222222";

        await repo.upsertWithItems({
            purchase: basePurchase,
            items: [],
            identityGroupId: newGroupId,
        });

        const set = getCapturedSet();
        expect(set.identityGroupId).toBeDefined();

        // Render the actual SQL: proves (a) COALESCE is used, (b) the bare
        // column reference resolves to the EXISTING row ("purchases" table,
        // not "excluded"), and (c) the supplied value is only the fallback —
        // exactly the semantics that make a redelivery unable to clobber an
        // already-set attribution.
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

        const set = getCapturedSet();
        // Key must be absent entirely, not set to undefined/null — an absent
        // key leaves the column untouched in the SET clause.
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

        const set = getCapturedSet();
        expect(set.status).toBe("refunded");
        expect(set.totalPrice).toBe("50.00");
        expect(set.currencyCode).toBe("EUR");
        expect(set.purchaseToken).toBe("tok-123");
        expect(set.updatedAt).toBeInstanceOf(Date);
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
