import { describe, expect, it } from "vitest";
import { extractMinPurchaseAmount, extractStartDate } from "./conditions";

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("extractMinPurchaseAmount", () => {
    it("reads a flat purchase.amount gte condition", () => {
        expect(
            extractMinPurchaseAmount([
                { field: "purchase.amount", operator: "gte", value: 50 },
            ])
        ).toBe(50);
    });

    it("walks nested groups and keeps the lowest threshold", () => {
        expect(
            extractMinPurchaseAmount({
                logic: "all",
                conditions: [
                    { field: "purchase.amount", operator: "gte", value: 80 },
                    {
                        logic: "any",
                        conditions: [
                            {
                                field: "purchase.amount",
                                operator: "gt",
                                value: 30,
                            },
                        ],
                    },
                ],
            })
        ).toBe(30);
    });

    it("returns undefined without a purchase gate", () => {
        expect(
            extractMinPurchaseAmount([
                { field: "user.isNew", operator: "eq", value: true },
            ])
        ).toBeUndefined();
    });
});

describe("extractStartDate", () => {
    it("reads a time.timestamp gte condition (unix seconds)", () => {
        const start = extractStartDate([
            {
                field: "time.timestamp",
                operator: "gte",
                value: unix("2025-02-01T00:00:00Z"),
            },
        ]);
        expect(start?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    });

    it("returns undefined without a start gate", () => {
        expect(extractStartDate([])).toBeUndefined();
    });
});
