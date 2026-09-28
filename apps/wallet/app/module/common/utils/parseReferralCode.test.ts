import { describe, expect, test } from "@/tests/vitest-fixtures";
import { parseReferralCode } from "./parseReferralCode";

describe("parseReferralCode", () => {
    test("accepts a well-formed 6-char uppercase code", () => {
        expect(parseReferralCode("FRAKPA")).toBe("FRAKPA");
    });

    test("uppercases a lowercase code", () => {
        expect(parseReferralCode("frakpa")).toBe("FRAKPA");
    });

    test("drops a code of the wrong length", () => {
        expect(parseReferralCode("FRAK")).toBeUndefined();
        expect(parseReferralCode("FRAKPAX")).toBeUndefined();
    });

    test("drops a code with non-alphanumeric characters", () => {
        expect(parseReferralCode("FRAK-A")).toBeUndefined();
    });

    test("drops a non-string value", () => {
        expect(parseReferralCode(42)).toBeUndefined();
        expect(parseReferralCode(undefined)).toBeUndefined();
    });
});
