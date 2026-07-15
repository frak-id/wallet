import { describe, expect, it } from "vitest";
import { extractAuthErrorMessage } from "./authError";

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
