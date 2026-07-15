import { describe, expect, it } from "vitest";
import { buildInvitationEmail } from "../../../../src/infrastructure/integrations/email/buildInvitationEmail";

// First email template embedding user-controlled strings (merchant name,
// inviter display name) — pin the escaping so a future edit can't silently
// reintroduce an HTML/phishing injection inside a DKIM-signed email.
describe("buildInvitationEmail — HTML escaping", () => {
    it("escapes HTML-significant characters in merchantName and inviterName in the body", () => {
        const { html } = buildInvitationEmail({
            merchantName: `<img src=x onerror=alert(1)>&"'`,
            inviterName: `<script>alert(1)</script>`,
            link: "https://business.frak.id/invite#token=abc",
        });

        expect(html).not.toContain("<img");
        expect(html).not.toContain("<script>");
        expect(html).toContain(
            "&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;"
        );
        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("does not escape the plain-text subject (not HTML)", () => {
        const { subject } = buildInvitationEmail({
            merchantName: "Smith & Co",
            inviterName: "Jane",
            link: "https://business.frak.id/invite#token=abc",
        });

        expect(subject).toBe("You've been invited to join Smith & Co on Frak");
    });

    it("passes the link through unescaped (server-generated, safe)", () => {
        const link = "https://business.frak.id/invite#token=abc123";
        const { html } = buildInvitationEmail({
            merchantName: "Acme",
            inviterName: "Jane",
            link,
        });

        expect(html).toContain(`href="${link}"`);
    });
});
