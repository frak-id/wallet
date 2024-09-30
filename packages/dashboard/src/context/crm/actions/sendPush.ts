"use server";

import {
    type GetMembersParam,
    getProductsMembersAddress,
} from "@/context/members/action/getProductMembers";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import type { Address } from "viem";

/**
 * Method used to send push notifications to a target audience
 */
export async function sendPushNotification({
    wallets,
    payload,
}: {
    wallets: Address[];
    payload: NotificationPayload;
}) {
    if (wallets.length === 0) {
        throw new Error("No wallets given");
    }

    // Send the push request
    await backendApi.notifications.send.post({
        wallets,
        payload: {
            ...payload,
            body: payload.body ?? "",
            silent: payload.silent ?? false,
        },
    });
}

/**
 * Send push notification for a given filter
 * @param filter
 * @param payload
 */
export async function sendPushForFilter({
    filter,
    payload,
}: {
    filter: GetMembersParam["filter"];
    payload: NotificationPayload;
}) {
    // Fetch the wallet that would receive this notification
    const wallets = await getProductsMembersAddress({ filter });
    if (wallets.length === 0) {
        throw new Error("No recipients found for filter");
    }

    // Then send the push
    return sendPushNotification({ wallets, payload });
}
