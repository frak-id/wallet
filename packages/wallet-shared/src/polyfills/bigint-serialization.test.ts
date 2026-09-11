import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupBigIntSerialization } from "./bigint-serialization";

describe("setupBigIntSerialization", () => {
    let originalToJSON: (() => string) | undefined;

    beforeEach(() => {
        originalToJSON = (BigInt.prototype as any).toJSON;
        delete (BigInt.prototype as any).toJSON;
    });

    afterEach(() => {
        if (originalToJSON) {
            (BigInt.prototype as any).toJSON = originalToJSON;
        }
    });

    it("should serialize BigInt as a decimal string", () => {
        setupBigIntSerialization();

        expect(JSON.stringify({ big: BigInt(-12345) })).toBe(
            '{"big":"-12345"}'
        );
    });

    it("should be idempotent", () => {
        setupBigIntSerialization();
        const firstToJSON = (BigInt.prototype as any).toJSON;

        setupBigIntSerialization();

        expect((BigInt.prototype as any).toJSON).toBe(firstToJSON);
    });

    it("should not override an existing toJSON", () => {
        const customToJSON = () => "custom";
        (BigInt.prototype as any).toJSON = customToJSON;

        setupBigIntSerialization();

        expect((BigInt.prototype as any).toJSON).toBe(customToJSON);
    });
});
