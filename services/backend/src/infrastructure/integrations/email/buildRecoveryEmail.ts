type RecoveryEmailParams = {
    /** The opaque, client-encrypted recovery backup, shown in clear text. */
    blob: string;
    /** Deeplink that prefills the backup on the recovery page (`/recovery#blob=…`). */
    link: string;
};

/**
 * Wallet-recovery email: a one-click deeplink that prefills the recovery page
 * with the backup, plus the backup in clear text as a manual fallback (the
 * user pastes it on the recovery screen). The blob is useless without the
 * recovery password, which the backend never holds — so mailing it is safe.
 */
export function buildRecoveryEmail({ blob, link }: RecoveryEmailParams): {
    subject: string;
    html: string;
} {
    const subject = "Recover your wallet — Frak";
    const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:600;padding-bottom:8px;">Recover your wallet</td></tr>
            <tr><td style="font-size:14px;line-height:20px;color:#52525b;padding-bottom:24px;">You asked to recover your Frak wallet. Tap the button below to open the recovery page with your backup already filled in — you'll just need the recovery password you chose during setup.</td></tr>
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:9999px;">Recover my wallet</a>
            </td></tr>
            <tr><td style="font-size:13px;line-height:20px;color:#52525b;padding-bottom:8px;">If the button doesn't work, copy this recovery backup and paste it on the recovery page:</td></tr>
            <tr><td style="font-size:12px;line-height:18px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;color:#18181b;word-break:break-all;background:#f4f4f5;border-radius:12px;padding:16px;">${blob}</td></tr>
            <tr><td style="font-size:12px;line-height:18px;color:#a1a1aa;padding-top:24px;">This backup can only be opened with your recovery password, which we never have. If you didn't request this, you can safely ignore this email.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
}
