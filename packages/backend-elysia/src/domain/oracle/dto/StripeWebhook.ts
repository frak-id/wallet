export type StripeWebhookDto = Readonly<{
    type: string;
    data: {
        // Payment intent type as peer as possible
        object: {
            id: string;
            object: "payment_intent" | (string & {});
            amount: number;
            amount_capturable: number;
            amount_received: number;
            application?: string | null;
            application_fee_amount?: number | null;
            automatic_payment_methods?: {
                enabled: boolean;
                allow_redirects?: "always" | "never";
            } | null;
            canceled_at?: number;
            cancellation_reason?:
                | "abandoned"
                | "automatic"
                | "duplicate"
                | "failed_invoice"
                | "fraudulent"
                | "requested_by_customer"
                | "void_invoice";
            client_secret?: string | null;
            created: number;
            currency: string;
            customer?: string | null;
            description?: string | null;
            invoice?: string | null;
            latest_charge?: string;
            // true for prod, false for test
            livemode: boolean;
            metadata: Record<string, string>;
            payment_method?: string | null;
            receipt_email?: string | null;
            review?: string | null;
            statement_descriptor?: string | null;
            statement_descriptor_suffix?: string | null;
            status: PaymentIntentStatusStatus;
        };
    };
}>;

export type PaymentIntentStatusStatus =
    | "canceled"
    | "processing"
    | "requires_action"
    | "requires_capture"
    | "requires_confirmation"
    | "requires_payment_method"
    | "succeeded"
    | (string & {});
