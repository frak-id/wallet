import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupBigIntSerialization } from "./bigint-serialization";

describe("setupBigIntSerialization", () => {
    let originalToJSON: (() => string) | undefined;

    beforeEach(() => {
        // Save original toJSON if it exists
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        originalToJSON = (BigInt.prototype as any).toJSON;
        // Remove toJSON to simulate fresh environment
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        delete (BigInt.prototype as any).toJSON;
    });

    afterEach(() => {
        // Restore original toJSON
        if (originalToJSON) {
            // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
            (BigInt.prototype as any).toJSON = originalToJSON;
        }
    });

    it("should add toJSON method to BigInt prototype", () => {
        setupBigIntSerialization();

        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        expect((BigInt.prototype as any).toJSON).toBeDefined();
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        expect(typeof (BigInt.prototype as any).toJSON).toBe("function");
    });

    it("should serialize BigInt to string", () => {
        setupBigIntSerialization();

        const bigInt = BigInt(12345);
        const result = JSON.stringify(bigInt);

        expect(result).toBe('"12345"');
    });

    it("should serialize large BigInt values", () => {
        setupBigIntSerialization();

        const largeBigInt = BigInt("9007199254740991"); // Max safe integer
        const result = JSON.stringify(largeBigInt);

        expect(result).toBe('"9007199254740991"');
    });

    it("should serialize very large BigInt values", () => {
        setupBigIntSerialization();

        const veryLargeBigInt = BigInt("999999999999999999999999999");
        const result = JSON.stringify(veryLargeBigInt);

        expect(result).toBe('"999999999999999999999999999"');
    });

    it("should serialize zero", () => {
        setupBigIntSerialization();

        const zero = BigInt(0);
        const result = JSON.stringify(zero);

        expect(result).toBe('"0"');
    });

    it("should serialize negative BigInt", () => {
        setupBigIntSerialization();

        const negative = BigInt(-12345);
        const result = JSON.stringify(negative);

        expect(result).toBe('"-12345"');
    });

    it("should work with JSON.stringify on objects containing BigInt", () => {
        setupBigIntSerialization();

        const obj = {
            number: 42,
            bigint: BigInt(123456789),
            string: "test",
        };

        const result = JSON.stringify(obj);
        const parsed = JSON.parse(result);

        expect(parsed.bigint).toBe("123456789");
        expect(parsed.number).toBe(42);
        expect(parsed.string).toBe("test");
    });

    it("should work with arrays containing BigInt", () => {
        setupBigIntSerialization();

        const arr = [1, BigInt(999), "test", BigInt(777)];
        const result = JSON.stringify(arr);

        expect(result).toBe('[1,"999","test","777"]');
    });

    it("should not override existing toJSON if already present", () => {
        // Add a custom toJSON first
        const customToJSON = () => "custom";
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        (BigInt.prototype as any).toJSON = customToJSON;

        setupBigIntSerialization();

        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        expect((BigInt.prototype as any).toJSON).toBe(customToJSON);

        // Custom function should still work
        const bigInt = BigInt(123);
        const result = JSON.stringify(bigInt);
        expect(result).toBe('"custom"');
    });

    it("should be idempotent", () => {
        setupBigIntSerialization();
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        const firstToJSON = (BigInt.prototype as any).toJSON;

        setupBigIntSerialization();
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        const secondToJSON = (BigInt.prototype as any).toJSON;

        expect(firstToJSON).toBe(secondToJSON);
    });

    it("should return string representation without quotes when called directly", () => {
        setupBigIntSerialization();

        const bigInt = BigInt(456);
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        const result = (bigInt as any).toJSON();

        expect(result).toBe("456");
        expect(typeof result).toBe("string");
    });

    it("should handle hex values converted to BigInt", () => {
        setupBigIntSerialization();

        const hexBigInt = BigInt("0x1a2b3c");
        const result = JSON.stringify(hexBigInt);

        // Should serialize to decimal string
        expect(result).toBe('"1715004"'); // 0x1a2b3c in decimal
    });
});
