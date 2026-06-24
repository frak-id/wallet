import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authenticatedBackendApi } from "@/api/backendClient";
import { pushCreationStore } from "@/stores/pushCreationStore";
import type { NotificationPayload } from "@/types/NotificationPayload";
import { deriveScheduledAt } from "./schedule";
import type { FormCreatePushNotification } from "./types";

/**
 * Route a composed broadcast to the right endpoint and return the Eden result.
 *
 * - new + immediate → `POST /send`
 * - new + scheduled → `POST /schedule`
 * - edit            → `PUT /broadcasts/:id` (updates the scheduled row in
 *   place; a scheduled notification stays scheduled and can't be switched to
 *   immediate delivery, so a delivery time is required)
 */
function submitBroadcast(params: {
    merchantId: string;
    editingId?: string;
    scheduledAt?: number;
    target: NonNullable<FormCreatePushNotification["target"]>;
    payload: NotificationPayload & { body: string; silent: boolean };
}) {
    const { merchantId, editingId, scheduledAt, target, payload } = params;
    const api = authenticatedBackendApi.notifications;

    if (editingId) {
        if (scheduledAt === undefined) {
            throw new Error("A scheduled notification needs a delivery time");
        }
        return api.broadcasts({ id: editingId }).put({
            merchantId,
            targets: target,
            payload,
            scheduledAt: new Date(scheduledAt),
        });
    }

    if (scheduledAt !== undefined) {
        return api.schedule.post({
            merchantId,
            targets: target,
            payload,
            scheduledAt: new Date(scheduledAt),
        });
    }

    return api.send.post({ merchantId, targets: target, payload });
}

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
 * Publish the composed push notification (see `submitBroadcast` for the
 * endpoint routing).
 *
 * On success the draft is cleared, the history query refreshed and the user
 * returns to the members list.
 */
export function useSendPushNotification(merchantId: string) {
    const clearForm = pushCreationStore((state) => state.clearForm);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["push", "publish"],
        mutationFn: async (data: FormCreatePushNotification) => {
            if (!data.target) {
                throw new Error("No target specified");
            }
            const { payload, target } = data;
            const normalizedPayload = {
                ...payload,
                body: payload.body ?? "",
                silent: payload.silent ?? false,
            };

            // Eden Treaty returns `{ data, error }` rather than throwing —
            // surface the error so `onError` fires and we keep the draft
            // intact for retry on a transient backend failure.
            const { error } = await submitBroadcast({
                merchantId,
                editingId: data.editingId,
                scheduledAt: deriveScheduledAt(data.schedule),
                target,
                payload: normalizedPayload,
            });
            if (error) {
                throw new Error(extractSendError(error));
            }
        },
        onSuccess: () => {
            // Cleanup on the success path only, so a transient failure
            // leaves the draft intact for retry.
            clearForm();
            // Refresh the push-history table so the freshly sent/scheduled
            // broadcast shows up without a manual reload.
            queryClient.invalidateQueries({
                queryKey: ["push", "history", merchantId],
            });
            navigate({
                to: "/m/$merchantId/members",
                params: { merchantId },
            });
        },
    });
}
