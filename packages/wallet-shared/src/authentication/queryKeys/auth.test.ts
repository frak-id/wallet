import { describe, expect, it } from "vitest";
import { authKey } from "./auth";

describe("authKey", () => {
    it("builds the literal keys the caches are invalidated by", () => {
        expect(authKey.login).toEqual(["auth", "login"]);
        expect(authKey.register).toEqual(["auth", "register"]);
        expect(authKey.demo.login).toEqual(["auth", "demo", "login"]);
        expect(authKey.demo.register).toEqual(["auth", "demo", "register"]);
        expect(authKey.previousAuthenticators).toEqual([
            "auth",
            "previousAuthenticators",
        ]);
    });
});
