import { randomUUID } from "node:crypto";
import ky, { type KyInstance } from "ky";

type SendEmailParams = {
    to: string;
    subject: string;
    html: string;
    /** Override the default sender (e.g. the dedicated security address). */
    from?: string;
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
            // `ky` only retries idempotent methods by default, so `post` must be
            // opted in explicitly or this block is a no-op for `send`. Paired
            // with the per-call `Idempotency-Key` below so a retry after a
            // partially-processed request can never send the email twice.
            retry: {
                limit: 2,
                methods: ["post"],
                statusCodes: [429, 503],
                backoffLimit: 5_000,
            },
        });
    }

    async send({
        to,
        subject,
        html,
        from,
    }: SendEmailParams): Promise<{ id: string }> {
        return this.api
            .post("emails", {
                json: { from: from ?? this.from, to: [to], subject, html },
                // Unique per logical send; reused across `ky`'s internal retries
                // (same request, same headers) so a retried 429/503 dedupes
                // server-side instead of dispatching a second email.
                headers: { "Idempotency-Key": randomUUID() },
            })
            .json<{ id: string }>();
    }
}

export const resendClient = new ResendClient();
