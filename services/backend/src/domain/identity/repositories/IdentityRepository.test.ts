import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityType } from "../schemas";
import { IdentityRepository } from "./IdentityRepository";

const { anonymousNodes, findFirstMock } = vi.hoisted(() => {
    type Row = { identityValue: string; createdAt: number };
    type Order = { column: string; direction: "asc" | "desc" };
    type FindFirstOptions = {
        orderBy?: (
            table: { createdAt: string },
            operators: {
                asc: (column: string) => Order;
                desc: (column: string) => Order;
            }
        ) => Order[];
    };

    const rows: Row[] = [];
    return {
        anonymousNodes: rows,
        findFirstMock: vi.fn((options: FindFirstOptions) => {
            const [order] =
                options.orderBy?.(
                    { createdAt: "createdAt" },
                    {
                        asc: (column) => ({
                            column,
                            direction: "asc" as const,
                        }),
                        desc: (column) => ({
                            column,
                            direction: "desc" as const,
                        }),
                    }
                ) ?? [];
            if (order?.column !== "createdAt") {
                return Promise.resolve(rows[0]);
            }
            const factor = order.direction === "asc" ? 1 : -1;
            const sorted = [...rows].sort(
                (a, b) => factor * (a.createdAt - b.createdAt)
            );
            return Promise.resolve(sorted[0]);
        }),
    };
});

vi.mock("@backend-infrastructure", () => ({
    db: { query: { identityNodesTable: { findFirst: findFirstMock } } },
}));

describe("IdentityRepository.findAnonymousFingerprint", () => {
    beforeEach(() => {
        anonymousNodes.length = 0;
    });

    it("returns the oldest node when a group holds two anonymous fingerprints for one merchant", async () => {
        anonymousNodes.push(
            { identityValue: "anon-newer", createdAt: 2_000 },
            { identityValue: "anon-older", createdAt: 1_000 }
        );

        const value = await new IdentityRepository().findAnonymousFingerprint({
            groupId: "group-1",
            merchantId: "merchant-1",
        });

        expect(value).toBe("anon-older");
    });
});

/**
 * The prefix is what makes latching a server-minted id safe, so the predicate
 * that enforces it is asserted on the rendered SQL rather than on the mock.
 */
describe("IdentityRepository.latchServerMintedProof", () => {
    function captureWhere() {
        const captured: { condition?: unknown } = {};
        const runner = {
            update: () => ({
                set: () => ({
                    where: (condition: unknown) => {
                        captured.condition = condition;
                        return Promise.resolve();
                    },
                }),
            }),
        };
        return { captured, runner };
    }

    it("escapes the underscore so `frakmintX…` cannot match the prefix", async () => {
        const { captured, runner } = captureWhere();

        await new IdentityRepository().latchServerMintedProof(
            { value: "frakmint_abc", merchantId: "merchant-1" },
            runner as never
        );

        const query = new PgDialect().sqlToQuery(captured.condition as never);
        expect(query.sql).toContain("ESCAPE E'\\\\'");
        expect(query.params).toContain("frakmint\\_%");
    });

    it("still binds the exact value, so the prefix alone never selects a row", async () => {
        const { captured, runner } = captureWhere();

        await new IdentityRepository().latchServerMintedProof(
            { value: "frakmint_abc", merchantId: "merchant-1" },
            runner as never
        );

        const query = new PgDialect().sqlToQuery(captured.condition as never);
        expect(query.params).toContain("frakmint_abc");
    });

    it("keeps the prefix predicate for a value that does not carry it", async () => {
        const { captured, runner } = captureWhere();

        await new IdentityRepository().latchServerMintedProof(
            { value: "anon-1", merchantId: "merchant-1" },
            runner as never
        );

        const query = new PgDialect().sqlToQuery(captured.condition as never);
        expect(query.params).toContain("frakmint\\_%");
        expect(query.params).toContain("anon-1");
    });
});

describe("IdentityRepository.findGroupByIdentity", () => {
    beforeEach(() => {
        anonymousNodes.length = 0;
        findFirstMock.mockClear();
    });

    async function capturedWhereFor(type: IdentityType, value: string) {
        await new IdentityRepository().findGroupByIdentity({
            type,
            value,
            merchantId: "merchant-1",
        });
        const [options] = findFirstMock.mock.calls.at(-1) ?? [];
        return new PgDialect().sqlToQuery(
            (options as unknown as { where: unknown }).where as never
        );
    }

    it("lower-cases an anonymous fingerprint, so one id cannot persist as two nodes", async () => {
        const query = await capturedWhereFor(
            "anonymous_fingerprint",
            "7F3A9B21-4C5D-4E6F-8A9B-0C1D2E3F4A5B"
        );

        expect(query.params).toContain("7f3a9b21-4c5d-4e6f-8a9b-0c1d2e3f4a5b");
    });

    it("still trims an email", async () => {
        const query = await capturedWhereFor("email", "  Bob@Example.COM ");

        expect(query.params).toContain("bob@example.com");
    });
});
