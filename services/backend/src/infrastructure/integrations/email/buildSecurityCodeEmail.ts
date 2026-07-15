type SecurityCodeEmailParams = {
    code: string;
    /** What the code unlocks — shown in the email copy. */
    intent:
        | "sign in"
        | "confirm a sensitive action"
        | "verify your email"
        | "reset your password";
    /**
     * Optional deep link that prefills + submits the code on the dashboard
     * (the code stays visible for manual entry). The fragment carrying the
     * code never reaches the server.
     */
    link?: string;
};

export function buildSecurityCodeEmail({
    code,
    intent,
    link,
}: SecurityCodeEmailParams): { subject: string; html: string } {
    const subject = "Your Frak Business security code";
    const linkButton = link
        ? `<tr><td align="center" style="padding:24px 0 0;">
              <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:9999px;">Continue on the dashboard</a>
            </td></tr>`
        : "";
    const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:8px;">Security code</td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">Enter this code to ${intent} on the Frak Business dashboard. It expires in 10 minutes.</td></tr>
            <tr><td align="center" style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0;background:#f4f4f5;border-radius:12px;">${code}</td></tr>
            ${linkButton}
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;padding-top:24px;">If you didn't request this code, someone may be trying to access your account — consider changing your password.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
}
