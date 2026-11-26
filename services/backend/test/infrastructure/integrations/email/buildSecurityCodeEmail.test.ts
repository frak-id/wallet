import { describe, expect, it } from "vitest";
import { buildSecurityCodeEmail } from "../../../../src/infrastructure/integrations/email/buildSecurityCodeEmail";

describe("buildSecurityCodeEmail", () => {
    it("words a login code as logging in, not as a sensitive action", () => {
        const { html } = buildSecurityCodeEmail({
            code: "123456",
            intent: "confirm a sensitive action",
        });

        expect(html).toContain("to confirm it's you on the Frak dashboard");
        expect(html).not.toContain("sensitive action");
        expect(html).toContain("123456");
    });

    it("adds the dashboard button only when a link is given", () => {
        const withLink = buildSecurityCodeEmail({
            code: "123456",
            intent: "verify your email",
            link: "https://business.frak.id/verify-email#code=123456",
        });
        const withoutLink = buildSecurityCodeEmail({
            code: "123456",
            intent: "verify your email",
        });

        expect(withLink.html).toContain("Continue on the dashboard");
        expect(withoutLink.html).not.toContain("Continue on the dashboard");
    });
});
