import ky, { type KyInstance } from "ky";

type SendEmailParams = {
    to: string;
    subject: string;
    html: string;
};

/**
 * Thin Resend REST adapter (no SDK), mirroring the OpenPanel `ky` client.
 *
 * Unlike OpenPanel this never throws on missing config: the singleton is
 * constructed at module load and `RESEND_API_KEY` is populated post-merge, so a
 * throw here would crash the whole backend. A send with no key fails at call
 * time (Resend 401) instead, scoped to the verification request.
 */
export class ResendClient {
    private readonly api: KyInstance;
    private readonly from: string;

    constructor() {
        this.from = process.env.RESEND_FROM_EMAIL ?? "noreply@frak-labs.com";
        this.api = ky.create({
            prefix: "https://api.resend.com",
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
            },
            timeout: 20_000,
            retry: { limit: 2, statusCodes: [429, 503], backoffLimit: 5_000 },
        });
    }

    async send({
        to,
        subject,
        html,
    }: SendEmailParams): Promise<{ id: string }> {
        return this.api
            .post("emails", {
                json: { from: this.from, to: [to], subject, html },
            })
            .json<{ id: string }>();
    }
}

export const resendClient = new ResendClient();
