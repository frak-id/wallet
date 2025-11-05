import { describe, expect, it } from "vitest";
import { getMyProductsMock } from "./mock";

describe("product mock actions", () => {
    describe("getMyProductsMock", () => {
        it("should return object with owner and operator arrays", async () => {
            const result = await getMyProductsMock();

            expect(result).toHaveProperty("owner");
            expect(result).toHaveProperty("operator");
            expect(Array.isArray(result.owner)).toBe(true);
            expect(Array.isArray(result.operator)).toBe(true);
        });

        it("should include product properties in owner array", async () => {
            const result = await getMyProductsMock();

            if (result.owner.length > 0) {
                for (const product of result.owner) {
                    expect(product).toHaveProperty("id");
                    expect(product).toHaveProperty("name");
                    expect(product).toHaveProperty("domain");
                    expect(typeof product.id).toBe("string");
                    expect(typeof product.name).toBe("string");
                    expect(typeof product.domain).toBe("string");
                }
            }
        });

        it("should include product properties in operator array", async () => {
            const result = await getMyProductsMock();

            if (result.operator.length > 0) {
                for (const product of result.operator) {
                    expect(product).toHaveProperty("id");
                    expect(product).toHaveProperty("name");
                    expect(product).toHaveProperty("domain");
                }
            }
        });

        it("should return consistent data on multiple calls", async () => {
            const result1 = await getMyProductsMock();
            const result2 = await getMyProductsMock();

            expect(result1).toEqual(result2);
        });

        it("should have at least one product between owner and operator", async () => {
            const result = await getMyProductsMock();
            const totalProducts = result.owner.length + result.operator.length;

            expect(totalProducts).toBeGreaterThan(0);
        });
    });
});
