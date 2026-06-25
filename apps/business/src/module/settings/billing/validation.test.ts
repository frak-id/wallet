import { describe, expect, it } from "vitest";
import { EMAIL_PATTERN } from "./validation";

describe("EMAIL_PATTERN", () => {
    it.each([
        "nowa@nowa-water.com",
        "a@b.co",
        "user.name+tag@sub.domain.io",
    ])("accepts %s", (email) => {
        expect(EMAIL_PATTERN.test(email)).toBe(true);
    });

    it.each([
        "test",
        "test@",
        "test@test",
        "@test.com",
        "a b@test.com",
        "test@test .com",
        "",
    ])("rejects %s", (email) => {
        expect(EMAIL_PATTERN.test(email)).toBe(false);
    });
});
