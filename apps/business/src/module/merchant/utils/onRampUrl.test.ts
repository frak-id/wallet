import { describe, expect, it } from "vitest";
import { buildOnRampUrl } from "./onRampUrl";

const MERCHANT_ID = "0b5a1c39-7a3e-4b8e-9d3c-2f1f6e8a9b10";

describe("buildOnRampUrl", () => {
    it("tags the payment link with the merchant and the account email", () => {
        const url = new URL(
            buildOnRampUrl("https://buy.stripe.com/abc?locale=fr", {
                merchantId: MERCHANT_ID,
                email: "jane+ops@acme.com",
            })
        );

        expect(url.origin + url.pathname).toBe("https://buy.stripe.com/abc");
        expect(url.searchParams.get("locale")).toBe("fr");
        expect(url.searchParams.get("client_reference_id")).toBe(MERCHANT_ID);
        expect(url.searchParams.get("prefilled_email")).toBe(
            "jane+ops@acme.com"
        );
    });

    it("leaves the email out when the account has none", () => {
        const url = new URL(
            buildOnRampUrl("https://buy.stripe.com/abc", {
                merchantId: MERCHANT_ID,
                email: null,
            })
        );

        expect(url.searchParams.has("prefilled_email")).toBe(false);
    });

    it.each([
        ["no link configured", undefined, "#"],
        ["a value that is not a URL", "not a url", "not a url"],
    ])("passes %s through", (_name, base, expected) => {
        expect(buildOnRampUrl(base, { merchantId: MERCHANT_ID })).toBe(
            expected
        );
    });
});
