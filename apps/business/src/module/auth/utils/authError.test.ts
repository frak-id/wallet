import { describe, expect, it } from "vitest";
import {
    extractAuthErrorMessage,
    isRejectedInput,
    toAuthError,
} from "./authError";

describe("extractAuthErrorMessage", () => {
    it("reads the `error` field of an Eden HttpError payload", () => {
        const edenError = {
            value: {
                success: false,
                code: "OTP_THROTTLED",
                error: "Retry in 45s",
            },
        };
        expect(extractAuthErrorMessage(edenError, "fallback")).toBe(
            "Retry in 45s"
        );
    });

    it("surfaces the message of an already-thrown Error (react-query case)", () => {
        // Hooks throw `new Error(extractAuthErrorMessage(...))`; display sites
        // call this again on that Error and must keep the real message rather
        // than falling back to a generic one.
        const thrown = new Error("Retry in 45s");
        expect(extractAuthErrorMessage(thrown, "generic")).toBe("Retry in 45s");
    });

    it("falls back when the Error carries no usable message", () => {
        expect(extractAuthErrorMessage(new Error(""), "generic")).toBe(
            "generic"
        );
        expect(extractAuthErrorMessage(undefined, "generic")).toBe("generic");
    });
});

describe("isRejectedInput", () => {
    it.each([
        [400, true],
        [401, true],
        [403, true],
        [429, false],
        [500, false],
        [503, false],
    ])("classifies an Eden %i as rejected input: %s", (status, expected) => {
        const error = toAuthError({ status, value: "Backend text" }, "x");
        expect(isRejectedInput(error)).toBe(expected);
    });

    it("treats an unreachable backend (Eden's 503 TypeError) as not rejected", () => {
        const error = toAuthError(
            { status: 503, value: new TypeError("Failed to fetch") },
            "x"
        );
        expect(isRejectedInput(error)).toBe(false);
    });

    it("is false for an error with no HTTP status", () => {
        expect(isRejectedInput(new Error("boom"))).toBe(false);
    });
});
