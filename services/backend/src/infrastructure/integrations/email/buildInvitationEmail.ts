type InvitationEmailParams = {
    /** Merchant display name — user-controlled at registration, escape it. */
    merchantName: string;
    /** Inviter's display name/email, or a generic fallback — also escape. */
    inviterName: string;
    /** `${BUSINESS_URL}/invite#token=…` — the token rides in the fragment. */
    link: string;
};

/**
 * Escape the five HTML-significant characters. This is the first email
 * template embedding user-controlled strings (every other builder only
 * interpolates server-generated codes/links) — `merchantName` and
 * `inviterName` must not be trusted verbatim inside a DKIM-signed email.
 */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Merchant-team invitation email: a one-click deeplink to the claim page,
 * which lands the invitee directly as a merchant admin (registration + email
 * verification happen in one step there — see `apps/business` `/invite`).
 */
export function buildInvitationEmail({
    merchantName,
    inviterName,
    link,
}: InvitationEmailParams): { subject: string; html: string } {
    const safeMerchantName = escapeHtml(merchantName);
    const safeInviterName = escapeHtml(inviterName);
    // Subject is plain text, not HTML — use the raw name (Resend/SMTP encode
    // headers safely; escaping here would leak literal "&amp;" into inboxes).
    const subject = `You've been invited to join ${merchantName} on Frak`;
    const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:8px;">You're invited</td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">${safeInviterName} invited you to join <strong>${safeMerchantName}</strong> as an admin on the Frak Business dashboard.</td></tr>
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:9999px;">Accept invitation</a>
            </td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;padding-top:24px;">This invitation link expires in 7 days. If you weren't expecting this, you can safely ignore this email.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
}
