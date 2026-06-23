import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authenticatedBackendApi } from "@/api/backendClient";
import { pushCreationStore } from "@/stores/pushCreationStore";
import type { FormCreatePushNotification } from "./types";

/**
 * Pull a human-readable message out of an Eden Treaty error.
 *
 * Eden returns `{ value, status }` where `value` is the body returned by
 * the Elysia handler — usually `{ message: string }`, sometimes a plain
 * string (legacy handlers). We walk both shapes before falling back to a
 * generic message so backend errors surface to the user.
 */
function extractSendError(error: unknown): string {
    if (typeof error === "string") return error;
    if (typeof error !== "object" || error === null) {
        return "Failed to send push notification";
    }
    const value = (error as { value?: unknown }).value;
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "object" && value !== null) {
        const message = (value as { message?: unknown }).message;
        if (typeof message === "string" && message.length > 0) return message;
    }
    return "Failed to send push notification";
}

/**
 * Publish (send) the composed push notification. On success the draft is
 * cleared and the user returns to the members list.
 */
export function useSendPushNotification(merchantId: string) {
    const clearForm = pushCreationStore((state) => state.clearForm);
    const navigate = useNavigate();

    return useMutation({
        mutationKey: ["push", "publish"],
        mutationFn: async (data: FormCreatePushNotification) => {
            if (!data.target) {
                throw new Error("No target specified");
            }
            const { payload, target } = data;
            // Eden Treaty returns `{ data, error }` rather than throwing —
            // surface the error so `onError` fires and we keep the draft
            // intact for retry on a transient backend failure.
            const { error: sendError } =
                await authenticatedBackendApi.notifications.send.post({
                    merchantId,
                    targets: target,
                    payload: {
                        ...payload,
                        body: payload.body ?? "",
                        silent: payload.silent ?? false,
                    },
                    // scheduledAt is intentionally not sent yet — the backend
                    // DTO doesn't accept it until delayed delivery lands
                    // (feat/scheduled-notifications). Wire it there.
                });
            if (sendError) {
                throw new Error(extractSendError(sendError));
            }
        },
        onSuccess: () => {
            // Cleanup on the success path only, so a transient failure
            // leaves the draft intact for retry.
            clearForm();
            navigate({
                to: "/m/$merchantId/members",
                params: { merchantId },
            });
        },
    });
}
