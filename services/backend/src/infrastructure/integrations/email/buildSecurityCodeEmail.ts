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

// A 2-step code is only sent after a first factor or a live session succeeded; anyone can trigger the other two.
const SOMEONE_ELSE =
    "If you did not ask for this code, someone may be trying to access your account. Consider changing your password.";
const SAFE_TO_IGNORE =
    "If you did not ask for this code, you can ignore this email.";

const INTENT_COPY: Record<
    SecurityCodeEmailParams["intent"],
    { action: string; ifNotYou: string }
> = {
    "sign in": { action: "log in", ifNotYou: SOMEONE_ELSE },
    "confirm a sensitive action": {
        action: "confirm it's you",
        ifNotYou: SOMEONE_ELSE,
    },
    "verify your email": {
        action: "verify your email",
        ifNotYou: SAFE_TO_IGNORE,
    },
    "reset your password": {
        action: "reset your password",
        ifNotYou: SAFE_TO_IGNORE,
    },
};

export function buildSecurityCodeEmail({
    code,
    intent,
    link,
}: SecurityCodeEmailParams): { subject: string; html: string } {
    const subject = "Your Frak security code";
    const { action, ifNotYou } = INTENT_COPY[intent];
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
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:8px;">Your code</td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">Enter this code to ${action} on the Frak dashboard. It expires in 10 minutes.</td></tr>
            <tr><td align="center" style="font-size:34px;font-weight:700;letter-spacing:8px;padding:16px 0;background:#f4f4f5;border-radius:12px;">${code}</td></tr>
            ${linkButton}
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;padding-top:24px;">${ifNotYou}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
}
