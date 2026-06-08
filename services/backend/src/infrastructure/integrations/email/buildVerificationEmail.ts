type VerificationEmailParams = {
    code: string;
    link: string;
};

export function buildVerificationEmail({
    code,
    link,
}: VerificationEmailParams): { subject: string; html: string } {
    const subject = "Verify your email — Frak";
    const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:8px;">Verify your email</td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">Enter this code in the wallet to confirm your email address. It expires in 10 minutes.</td></tr>
            <tr><td align="center" style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0;background:#f4f4f5;border-radius:12px;">${code}</td></tr>
            <tr><td align="center" style="padding:24px 0 8px;">
              <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:9999px;">Verify my email</a>
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;padding-top:16px;">If you didn't request this, you can safely ignore this email.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
}
