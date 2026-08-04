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
        expect(buildHostResultUrl({ scheme: "frak-a", action: "share" })).toBe(
            "frak-a://result?action=share"
        );
        expect(buildHostResultUrl({ scheme: "frak-a", action: "copy" })).toBe(
            "frak-a://result?action=copy"
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

describe("buildHostResultUrl — the code action", () => {
    it("carries the value and its expiry", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "code",
                sid: "s1",
                value: "ABC234",
                expiresAt: 1_700_000_000,
            })
        ).toBe(
            "frak-acme://result?action=code&sid=s1&value=ABC234&exp=1700000000"
        );
    });

    it("escapes a value so it cannot inject extra params", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "code",
                value: "A&action=install",
            })
        ).toBe("frak-acme://result?action=code&value=A%26action%3Dinstall");
    });

    it("omits the expiry when there is none", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "code",
                value: "ABC234",
            })
        ).toBe("frak-acme://result?action=code&value=ABC234");
    });

    it("never puts a value on any other action", () => {
        // Only `code` has the exception in 01 §1.2; nothing else may carry a capability.
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "install",
                value: "ABC234",
            })
        ).toBe("frak-acme://result?action=install");
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

    it("lets share and copy through every time they are pressed", () => {
        // Both are button presses, not guard re-runs: copying and then sharing,
        // or retrying a share whose chooser the user backed out of, all have to
        // reach the host. The page reloads between a share and its
        // confirmation, but nothing guarantees that ordering here.
        sendHostResult({ scheme: "frak-acme", action: "share", sid: "s1" });
        sendHostResult({ scheme: "frak-acme", action: "share", sid: "s1" });
        sendHostResult({ scheme: "frak-acme", action: "copy", sid: "s1" });
        sendHostResult({ scheme: "frak-acme", action: "copy", sid: "s1" });

        expect(assign).toHaveBeenCalledTimes(4);
        expect(assign).toHaveBeenLastCalledWith(
            "frak-acme://result?action=copy&sid=s1"
        );
    });

    it("still reports each distinct outcome", () => {
        sendHostResult({ scheme: "frak-acme", action: "install" });
        sendHostResult({ scheme: "frak-acme", action: "dismiss" });

        expect(assign).toHaveBeenCalledTimes(2);
    });

    it("lets a regenerated code through, but not the same one twice", () => {
        // The code is refetchable, and a pasteboard holding a code the page is no longer
        // showing is worse than none. Dedupe is per value, not per action.
        expect(
            sendHostResult({
                scheme: "frak-acme",
                action: "code",
                value: "AAA111",
            })
        ).toBe(true);
        expect(assign).toHaveBeenCalledTimes(1);

        sendHostResult({
            scheme: "frak-acme",
            action: "code",
            value: "AAA111",
        });
        expect(assign).toHaveBeenCalledTimes(1);

        sendHostResult({
            scheme: "frak-acme",
            action: "code",
            value: "BBB222",
        });
        expect(assign).toHaveBeenCalledTimes(2);
        expect(assign).toHaveBeenLastCalledWith(
            "frak-acme://result?action=code&value=BBB222"
        );
    });

    it("reports no host to hand off to, so callers keep their web behaviour", () => {
        expect(sendHostResult({ action: "dismiss" })).toBe(false);
        expect(assign).not.toHaveBeenCalled();
    });
});
