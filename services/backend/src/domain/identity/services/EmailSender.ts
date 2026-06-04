export type SendEmailParams = {
    to: string;
    subject: string;
    html: string;
};

/**
 * Outbound transactional-email port. The identity service depends on this
 * abstraction; the concrete adapter (Resend) lives in infrastructure and is
 * injected via `IdentityContext`, so the domain never imports the provider.
 */
export interface EmailSender {
    send(params: SendEmailParams): Promise<{ id: string }>;
}
