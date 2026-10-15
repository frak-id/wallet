import { describe, expect, test } from "vitest";
import {
    createMoneriumError,
    getMoneriumErrorKey,
    isMoneriumRetryable,
    unwrapMoneriumResponse,
} from "./moneriumErrors";

describe("unwrapMoneriumResponse", () => {
    test("returns data", () => {
        expect(unwrapMoneriumResponse({ data: { a: 1 }, error: null })).toEqual(
            { a: 1 }
        );
    });

    test("throws a coded error from the backend body", () => {
        const run = () =>
            unwrapMoneriumResponse({
                data: null,
                error: {
                    status: 422,
                    value: { code: "MONERIUM_SIWE_REJECTED" },
                },
            });
        expect(run).toThrow();
        try {
            run();
        } catch (error) {
            expect(getMoneriumErrorKey(error)).toBe(
                "monerium.errors.siweRejected"
            );
        }
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
            getMoneriumErrorKey(new Error("User rejected the request"))
        ).toBe("monerium.errors.cancelled");
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
});
