import { describe, expect, it } from "vitest";
import { EMAIL_REGEX, isValidEmail } from "./email";

describe("isValidEmail", () => {
    it.each([
        "nowa@nowa-water.com",
        "a@b.co",
        "user.name+tag@sub.domain.io",
        "  trimmed@example.com  ",
    ])("accepts %j", (email) => {
        expect(isValidEmail(email)).toBe(true);
    });

    it.each([
        "test",
        "test@",
        "test@test",
        "@test.com",
        "a b@test.com",
        "test@test .com",
        "",
        "   ",
    ])("rejects %j", (email) => {
        expect(isValidEmail(email)).toBe(false);
    });

    it("exposes the raw regex (no trimming) for callers that need it", () => {
        expect(EMAIL_REGEX.test("a@b.co")).toBe(true);
        expect(EMAIL_REGEX.test(" a@b.co ")).toBe(false);
    });
});
