import { describe, expect, it } from "vitest";
import { authKey } from "./auth";

describe("authKey", () => {
    describe("login", () => {
        it("should return constant mutation key", () => {
            expect(authKey.login).toEqual(["auth", "login"]);
        });

        it("should be an array with 2 elements", () => {
            expect(authKey.login).toHaveLength(2);
        });

        it("should have auth as base key", () => {
            expect(authKey.login[0]).toBe("auth");
        });

        it("should always return the same reference", () => {
            const ref1 = authKey.login;
            const ref2 = authKey.login;

            expect(ref1).toBe(ref2);
        });
    });

    describe("register", () => {
        it("should return constant mutation key", () => {
            expect(authKey.register).toEqual(["auth", "register"]);
        });

        it("should be an array with 2 elements", () => {
            expect(authKey.register).toHaveLength(2);
        });

        it("should have auth as base key", () => {
            expect(authKey.register[0]).toBe("auth");
        });

        it("should always return the same reference", () => {
            const ref1 = authKey.register;
            const ref2 = authKey.register;

            expect(ref1).toBe(ref2);
        });
    });

    describe("demo.login", () => {
        it("should return constant mutation key", () => {
            expect(authKey.demo.login).toEqual(["auth", "demo", "login"]);
        });

        it("should be an array with 3 elements", () => {
            expect(authKey.demo.login).toHaveLength(3);
        });

        it("should have auth as base key", () => {
            expect(authKey.demo.login[0]).toBe("auth");
        });

        it("should have demo as second element", () => {
            expect(authKey.demo.login[1]).toBe("demo");
        });

        it("should always return the same reference", () => {
            const ref1 = authKey.demo.login;
            const ref2 = authKey.demo.login;

            expect(ref1).toBe(ref2);
        });
    });

    describe("demo.register", () => {
        it("should return constant mutation key", () => {
            expect(authKey.demo.register).toEqual(["auth", "demo", "register"]);
        });

        it("should be an array with 3 elements", () => {
            expect(authKey.demo.register).toHaveLength(3);
        });

        it("should have auth as base key", () => {
            expect(authKey.demo.register[0]).toBe("auth");
        });

        it("should have demo as second element", () => {
            expect(authKey.demo.register[1]).toBe("demo");
        });

        it("should always return the same reference", () => {
            const ref1 = authKey.demo.register;
            const ref2 = authKey.demo.register;

            expect(ref1).toBe(ref2);
        });
    });

    describe("previousAuthenticators", () => {
        it("should return constant query key", () => {
            expect(authKey.previousAuthenticators).toEqual([
                "auth",
                "previousAuthenticators",
            ]);
        });

        it("should be an array with 2 elements", () => {
            expect(authKey.previousAuthenticators).toHaveLength(2);
        });

        it("should have auth as base key", () => {
            expect(authKey.previousAuthenticators[0]).toBe("auth");
        });

        it("should always return the same reference", () => {
            const ref1 = authKey.previousAuthenticators;
            const ref2 = authKey.previousAuthenticators;

            expect(ref1).toBe(ref2);
        });
    });

    describe("mutation keys consistency", () => {
        it("should have unique keys for login and register", () => {
            expect(authKey.login).not.toEqual(authKey.register);
        });

        it("should have unique keys for demo login and demo register", () => {
            expect(authKey.demo.login).not.toEqual(authKey.demo.register);
        });

        it("should have unique keys for regular and demo login", () => {
            expect(authKey.login).not.toEqual(authKey.demo.login);
        });

        it("should have unique keys for regular and demo register", () => {
            expect(authKey.register).not.toEqual(authKey.demo.register);
        });
    });
});
