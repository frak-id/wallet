import { describe, expect, it } from "vitest";
import { getProductMembersMock, getProductsMembersCountMock } from "./mock";

describe("members mock actions", () => {
    describe("getProductMembersMock", () => {
        it("should return paginated member data", async () => {
            const result = await getProductMembersMock({
                limit: 10,
                offset: 0,
            });

            expect(result).toHaveProperty("totalResult");
            expect(result).toHaveProperty("members");
            expect(Array.isArray(result.members)).toBe(true);
        });

        it("should respect pagination limit", async () => {
            const result = await getProductMembersMock({
                limit: 5,
                offset: 0,
            });

            expect(result.members.length).toBeLessThanOrEqual(5);
        });

        it("should handle pagination offset", async () => {
            const firstPage = await getProductMembersMock({
                limit: 5,
                offset: 0,
            });

            const secondPage = await getProductMembersMock({
                limit: 5,
                offset: 5,
            });

            if (firstPage.totalResult > 5) {
                // Should have different members
                expect(firstPage.members[0]).not.toEqual(secondPage.members[0]);
            }
        });

        it("should filter by product IDs", async () => {
            const productId = "0x1234567890123456789012345678901234567890";

            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                filter: {
                    productIds: [productId as any],
                },
            });

            expect(result).toBeDefined();
            expect(result.members).toBeDefined();
        });

        it("should filter by interaction count min", async () => {
            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                filter: {
                    interactions: {
                        min: 10,
                    },
                },
            });

            expect(result).toBeDefined();
        });

        it("should filter by interaction count max", async () => {
            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                filter: {
                    interactions: {
                        max: 100,
                    },
                },
            });

            expect(result).toBeDefined();
        });

        it("should filter by timestamp", async () => {
            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                filter: {
                    firstInteractionTimestamp: {
                        min: 1704067200,
                    },
                },
            });

            expect(result).toBeDefined();
        });

        it("should sort by user", async () => {
            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                sort: {
                    by: "user",
                    order: "asc",
                },
            });

            expect(result.members).toBeDefined();
        });

        it("should sort by totalInteractions", async () => {
            const result = await getProductMembersMock({
                limit: 20,
                offset: 0,
                sort: {
                    by: "totalInteractions",
                    order: "desc",
                },
            });

            expect(result.members).toBeDefined();
        });
    });

    describe("getProductsMembersCountMock", () => {
        it("should return count of members", async () => {
            const result = await getProductsMembersCountMock({});

            expect(typeof result).toBe("number");
            expect(result).toBeGreaterThanOrEqual(0);
        });

        it("should apply filters to count", async () => {
            const resultNoFilter = await getProductsMembersCountMock({});

            const resultWithFilter = await getProductsMembersCountMock({
                filter: {
                    interactions: {
                        min: 1000,
                    },
                },
            });

            expect(resultWithFilter).toBeLessThanOrEqual(resultNoFilter);
        });
    });
});
