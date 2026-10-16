import { describe, expect, test } from "vitest";
import { fail, ok } from "@/tests/moneriumFixtures";
import {
    createMoneriumError,
    getMoneriumErrorKey,
    isMoneriumRetryable,
    unwrapMoneriumResponse,
} from "./moneriumErrors";

describe("unwrapMoneriumResponse", () => {
    test("returns data", () => {
        expect(unwrapMoneriumResponse(ok({ a: 1 }))).toEqual({ a: 1 });
    });

    test("an empty success is a failure without a code", () => {
        expect(() =>
            unwrapMoneriumResponse({ data: null, error: null })
        ).toThrow(expect.objectContaining({ code: null, status: null }));
    });

    test("throws a coded error from the backend body", () => {
        expect(() =>
            unwrapMoneriumResponse(fail(422, "MONERIUM_SIWE_REJECTED"))
        ).toThrow(
            expect.objectContaining({
                code: "MONERIUM_SIWE_REJECTED",
                status: 422,
            })
        );
    });

    test("an unknown code falls back to the generic message", () => {
        const error = createMoneriumError(null, { status: 400 });
        expect(getMoneriumErrorKey(error)).toBe("monerium.errors.generic");
    });
});

describe("getMoneriumErrorKey", () => {
    test("a dismissed prompt has its own message", () => {
        const error = Object.assign(new Error("x"), {
            name: "NotAllowedError",
        });
        expect(getMoneriumErrorKey(error)).toBe("monerium.errors.cancelled");
        expect(
            getMoneriumErrorKey(
                Object.assign(new Error("User rejected the request"), {
                    name: "UserRejectedRequestError",
                })
            )
        ).toBe("monerium.errors.cancelled");
    });

    test("a passkey sync failure is not read as a dismissed prompt", () => {
        const error = Object.assign(
            new Error("Unable to decrypt the private key"),
            { name: "NotAllowedError" }
        );
        expect(getMoneriumErrorKey(error)).toBe("monerium.errors.generic");
    });

    test("a 5xx without a code reads as a network problem", () => {
        expect(
            getMoneriumErrorKey(createMoneriumError(null, { status: 503 }))
        ).toBe("monerium.errors.network");
    });
});

describe("isMoneriumRetryable", () => {
    test("retries only upstream outages and 5xx", () => {
        expect(
            isMoneriumRetryable(
                createMoneriumError("MONERIUM_UPSTREAM_UNAVAILABLE", {
                    status: 502,
                })
            )
        ).toBe(true);
        expect(
            isMoneriumRetryable(
                createMoneriumError("MONERIUM_INVALID_IBAN", { status: 422 })
            )
        ).toBe(false);
        expect(
            isMoneriumRetryable(createMoneriumError(null, { status: 503 }))
        ).toBe(true);
        expect(
            isMoneriumRetryable(createMoneriumError(null, { status: 401 }))
        ).toBe(false);
    });

    test("a network failure that never got an answer is retried", () => {
        expect(isMoneriumRetryable(new TypeError("Failed to fetch"))).toBe(
            true
        );
    });
});
