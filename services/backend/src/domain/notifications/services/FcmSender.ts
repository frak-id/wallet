import { log } from "@backend-infrastructure";
import {
    cert,
    getApps,
    initializeApp,
    type ServiceAccount,
} from "firebase-admin/app";
import { type BatchResponse, getMessaging } from "firebase-admin/messaging";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

const FCM_BATCH_SIZE = 500;

function getFirebaseApp() {
    const existing = getApps();
    if (existing.length > 0) {
        return existing[0];
    }

    const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        return null;
    }

    let serviceAccount: ServiceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
        log.error(
            "[FcmSender] FCM_SERVICE_ACCOUNT_JSON is not valid JSON, skipping Firebase init"
        );
        return null;
    }

    try {
        return initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (error) {
        log.error(
            { error },
            "[FcmSender] Failed to initialize Firebase app — check FCM_SERVICE_ACCOUNT_JSON format"
        );
        return null;
    }
}

export class FcmSender {
    /**
     * Send a notification to a list of FCM registration tokens.
     * Returns the list of invalid tokens that should be removed from the database.
     */
    async send({
        tokens,
        payload,
    }: {
        tokens: string[];
        payload: SendNotificationPayload;
    }): Promise<string[]> {
        const app = getFirebaseApp();
        if (!app) {
            log.warn(
                "[FcmSender] Firebase not configured (FCM_SERVICE_ACCOUNT_JSON missing), skipping FCM send"
            );
            return [];
        }

        const messaging = getMessaging(app);
        const invalidTokens: string[] = [];

        for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
            const batch = tokens.slice(i, i + FCM_BATCH_SIZE);

            let response: BatchResponse;
            try {
                response = await messaging.sendEachForMulticast({
                    tokens: batch,
                    notification: {
                        title: payload.title,
                        body: payload.body,
                        ...(payload.icon && { imageUrl: payload.icon }),
                    },
                    data: payload.data?.url
                        ? { url: payload.data.url }
                        : undefined,
                });
            } catch (error) {
                log.warn(
                    { error },
                    `[FcmSender] Batch ${Math.floor(i / FCM_BATCH_SIZE) + 1} failed entirely`
                );
                continue;
            }

            invalidTokens.push(...this.extractInvalidTokens(batch, response));
        }

        if (invalidTokens.length > 0) {
            log.info(
                `[FcmSender] Found ${invalidTokens.length} invalid FCM token(s) to clean up`
            );
        }

        return invalidTokens;
    }

    private extractInvalidTokens(
        tokens: string[],
        response: BatchResponse
    ): string[] {
        const invalid: string[] = [];

        for (let i = 0; i < response.responses.length; i++) {
            const result = response.responses[i];
            if (result.success) continue;

            const errorCode = result.error?.code;
            if (
                errorCode === "messaging/invalid-registration-token" ||
                errorCode === "messaging/registration-token-not-registered" ||
                errorCode === "messaging/mismatched-credential"
            ) {
                invalid.push(tokens[i]);
            } else {
                log.warn(
                    { errorCode, tokenPrefix: tokens[i].slice(0, 8) },
                    "[FcmSender] Non-fatal send error"
                );
            }
        }

        return invalid;
    }
}
