import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authenticatedBackendApi } from "@/api/backendClient";
import { pushCreationStore } from "@/stores/pushCreationStore";
import { deriveScheduledAt } from "./schedule";
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
 * Publish the composed push notification.
 *
 * - new + immediate    → `POST /send`
 * - new + scheduled    → `POST /schedule`
 * - edit + scheduled   → `PUT /scheduled/:id` (updates in place, no duplicate)
 * - edit + immediate   → `POST /send`, then drop the now-stale scheduled row
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
            const scheduledAt = deriveScheduledAt(data.schedule);
            const { editingId } = data;

            // Eden Treaty returns `{ data, error }` rather than throwing —
            // surface the error so `onError` fires and we keep the draft
            // intact for retry on a transient backend failure.
            if (scheduledAt !== undefined) {
                const scheduledDate = new Date(scheduledAt);
                // Editing a planned notification updates it in place rather
                // than queueing a duplicate broadcast.
                const { error } = editingId
                    ? await authenticatedBackendApi.notifications
                          .broadcasts({ id: editingId })
                          .put({
                              merchantId,
                              targets: target,
                              payload: normalizedPayload,
                              scheduledAt: scheduledDate,
                          })
                    : await authenticatedBackendApi.notifications.schedule.post(
                          {
                              merchantId,
                              targets: target,
                              payload: normalizedPayload,
                              scheduledAt: scheduledDate,
                          }
                      );
                if (error) {
                    throw new Error(extractSendError(error));
                }
                return;
            }

            const { error: sendError } =
                await authenticatedBackendApi.notifications.send.post({
                    merchantId,
                    targets: target,
                    payload: normalizedPayload,
                });
            if (sendError) {
                throw new Error(extractSendError(sendError));
            }

            // Switching a planned notification to immediate delivery: the
            // broadcast just went out via /send, so remove the scheduled row
            // it replaced (best-effort — a leftover would re-send at its time).
            if (editingId) {
                await authenticatedBackendApi.notifications
                    .broadcasts({ id: editingId })
                    .delete({}, { query: { merchantId } });
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
