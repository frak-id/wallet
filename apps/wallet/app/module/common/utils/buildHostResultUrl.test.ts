import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildHostResultUrl,
    resetHostResults,
    sendHostResult,
} from "./buildHostResultUrl";

// A shipped SDK binary parses these URLs and can never be updated to match a
// change here, so the exact shape is the contract.
describe("buildHostResultUrl", () => {
    it("builds the documented shape", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "install",
                sid: "s1",
            })
        ).toBe("frak-acme://result?action=install&sid=s1");
    });

    it("omits sid when the host did not supply one", () => {
        expect(
            buildHostResultUrl({ scheme: "frak-acme", action: "dismiss" })
        ).toBe("frak-acme://result?action=dismiss");
    });

    it("covers every action", () => {
        expect(
            buildHostResultUrl({ scheme: "frak-a", action: "shareAgain" })
        ).toBe("frak-a://result?action=shareAgain");
        expect(buildHostResultUrl({ scheme: "frak-a", action: "error" })).toBe(
            "frak-a://result?action=error"
        );
    });

    it("escapes a sid so it cannot inject extra params", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "install",
                sid: "a&action=dismiss",
            })
        ).toBe("frak-acme://result?action=install&sid=a%26action%3Ddismiss");
    });
});

describe("sendHostResult", () => {
    let assign: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        resetHostResults();
        assign = vi.fn();
        vi.stubGlobal("location", { assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("hands an outcome to the host once, however often it is asked", () => {
        // Route guards re-run, so the same outcome arrives more than once.
        // Both copies carry the session's own sid, leaving the host no way to
        // tell a repeat from a genuine second outcome.
        const args = {
            scheme: "frak-acme",
            action: "error",
            sid: "s1",
        } as const;

        expect(sendHostResult(args)).toBe(true);
        expect(sendHostResult(args)).toBe(true);

        expect(assign).toHaveBeenCalledTimes(1);
        expect(assign).toHaveBeenCalledWith(
            "frak-acme://result?action=error&sid=s1"
        );
    });

    it("still reports each distinct outcome", () => {
        sendHostResult({ scheme: "frak-acme", action: "install" });
        sendHostResult({ scheme: "frak-acme", action: "dismiss" });

        expect(assign).toHaveBeenCalledTimes(2);
    });

    it("reports no host to hand off to, so callers keep their web behaviour", () => {
        expect(sendHostResult({ action: "dismiss" })).toBe(false);
        expect(assign).not.toHaveBeenCalled();
    });
});
