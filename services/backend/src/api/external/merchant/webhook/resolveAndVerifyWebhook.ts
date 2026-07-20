import { log } from "@backend-infrastructure";
import { HttpError, validateBodyHmac } from "@backend-utils";
import { OrchestrationContext } from "../../../../orchestration/context";

/**
 * Resolve a merchant webhook by merchant identifier and verify the request
 * body against the webhook's HMAC signature. Throws the same `HttpError`s
 * each platform handler previously threw inline.
 */
export async function resolveAndVerifyWebhook({
    merchantId,
    body,
    signature,
}: {
    merchantId: string | undefined;
    body: string;
    signature?: string;
}) {
    if (!merchantId) {
        throw HttpError.badRequest(
            "WEBHOOK_ERROR",
            "Missing merchant identifier"
        );
    }

    const resolved =
        await OrchestrationContext.orchestrators.webhookResolver.resolveWebhook(
            merchantId
        );
    if (!resolved) {
        log.warn({ merchantId }, "Webhook not found");
        throw HttpError.badRequest("WEBHOOK_ERROR", "Webhook not found");
    }

    validateBodyHmac({
        body,
        secret: resolved.webhook.hookSignatureKey,
        signature,
    });

    return resolved;
}
