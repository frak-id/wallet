import { describe, expect, it } from "vitest";
import { buildHostResultUrl } from "./buildHostResultUrl";

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
