import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHostResultUrl, resetHostResults, sendHostResult } from "./bridge";

// A shipped SDK binary parses these URLs, so the exact shape is the contract.
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
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "install",
                value: "ABC234",
            })
        ).toBe("frak-acme://result?action=install");
    });
});

describe("buildHostResultUrl — the share action", () => {
    it("carries the resolved title, text and image", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "share",
                sid: "s1",
                share: {
                    title: "Kettle deal",
                    text: "Grab it",
                    image: "https://cdn.example.com/p.png",
                },
            })
        ).toBe(
            "frak-acme://result?action=share&sid=s1&title=Kettle+deal&text=Grab+it&image=https%3A%2F%2Fcdn.example.com%2Fp.png"
        );
    });

    it("omits every field the payload did not carry", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "share",
                sid: "s1",
                share: {},
            })
        ).toBe("frak-acme://result?action=share&sid=s1");
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "share",
                sid: "s1",
            })
        ).toBe("frak-acme://result?action=share&sid=s1");
    });

    it("never puts a share payload on any other action", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "dismiss",
                share: { title: "Leaked" },
            })
        ).toBe("frak-acme://result?action=dismiss");
    });

    it("escapes payload values so they cannot inject extra params", () => {
        expect(
            buildHostResultUrl({
                scheme: "frak-acme",
                action: "share",
                share: { title: "a&action=dismiss" },
            })
        ).toBe("frak-acme://result?action=share&title=a%26action%3Ddismiss");
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

    it("lets the next sheet repeat an outcome the previous one already sent", () => {
        // A pooled web view hands the same document to the next presentation, so
        // this module's state outlives the session that filled it. Keyed by
        // action alone, the second sheet's Install tap died here.
        expect(
            sendHostResult({
                scheme: "frak-acme",
                action: "install",
                sid: "s1",
            })
        ).toBe(true);
        sendHostResult({ scheme: "frak-acme", action: "install", sid: "s2" });

        expect(assign).toHaveBeenCalledTimes(2);
        expect(assign).toHaveBeenLastCalledWith(
            "frak-acme://result?action=install&sid=s2"
        );
    });

    it("still refuses a second tap inside one sheet", () => {
        const args = {
            scheme: "frak-acme",
            action: "install",
            sid: "s1",
        } as const;

        sendHostResult(args);
        sendHostResult(args);

        expect(assign).toHaveBeenCalledTimes(1);
    });

    it("lets a regenerated code through, but not the same one twice", () => {
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

    it("carries the share payload through to the host", () => {
        sendHostResult({
            scheme: "frak-acme",
            action: "share",
            sid: "s1",
            share: { title: "Kettle deal", text: "Grab it" },
        });

        expect(assign).toHaveBeenCalledWith(
            "frak-acme://result?action=share&sid=s1&title=Kettle+deal&text=Grab+it"
        );
    });
});
