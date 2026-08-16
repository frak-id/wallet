import { beforeEach, describe, expect, it, vi } from "vitest";
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
