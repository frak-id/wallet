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

    it("warns that an unrequested 2-step code means someone is trying to get in", () => {
        const { html } = buildSecurityCodeEmail({
            code: "123456",
            intent: "confirm a sensitive action",
        });

        expect(html).toContain("someone may be trying to access your account");
        expect(html).not.toContain("ignore this email");
    });

    it.each(["reset your password", "verify your email"] as const)(
        "lets the reader ignore an unrequested %s code",
        (intent) => {
            const { html } = buildSecurityCodeEmail({ code: "123456", intent });

            expect(html).toContain("you can ignore this email");
            expect(html).not.toContain("someone may be trying");
        }
    );

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
