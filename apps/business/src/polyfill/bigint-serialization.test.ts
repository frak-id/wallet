import { describe, expect, test } from "vitest";
import "./bigint-serialization";

describe("BigInt serialization polyfill", () => {
    test("should add toJSON method to BigInt prototype", () => {
        expect(BigInt.prototype.toJSON).toBeDefined();
        expect(typeof BigInt.prototype.toJSON).toBe("function");
    });

    test("should serialize BigInt to string", () => {
        const bigIntValue = BigInt(123456789);
        expect(bigIntValue.toJSON()).toBe("123456789");
    });

    test("should serialize large BigInt values", () => {
        const largeBigInt = BigInt("9007199254740991"); // MAX_SAFE_INTEGER
        expect(largeBigInt.toJSON()).toBe("9007199254740991");
    });

    test("should serialize negative BigInt values", () => {
        const negativeBigInt = BigInt(-42);
        expect(negativeBigInt.toJSON()).toBe("-42");
    });

    test("should serialize zero", () => {
        const zeroBigInt = BigInt(0);
        expect(zeroBigInt.toJSON()).toBe("0");
    });

    test("should work with JSON.stringify", () => {
        const obj = {
            value: BigInt(123),
            nested: {
                bigNum: BigInt(999),
            },
        };

        const jsonString = JSON.stringify(obj);
        expect(jsonString).toBe('{"value":"123","nested":{"bigNum":"999"}}');
    });

    test("should handle very large numbers beyond Number.MAX_SAFE_INTEGER", () => {
        const veryLargeBigInt = BigInt("12345678901234567890");
        expect(veryLargeBigInt.toJSON()).toBe("12345678901234567890");
    });
});
