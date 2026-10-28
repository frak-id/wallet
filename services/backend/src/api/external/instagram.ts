import { log } from "@backend-infrastructure";
import { constantTimeStringEqual, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    extractTextMessages,
    InstagramContext,
    isValidMetaSignature,
    readInstagramConfig,
} from "../../domain/instagram";

/**
 * Meta's webhook for DMs to the connected account. Anything but a 200 is
 * redelivered for up to 36 h, which is the retry when Meta or the database
 * fails mid-batch: a handled code is deleted, so a replay changes nothing.
 */
export const instagramWebhookRoutes = new Elysia({ prefix: "/instagram" })
    .get(
        "/webhook",
        ({ query }) => {
            const config = readInstagramConfig();
            if (!config) return status(404, "Not Found");
            const verified =
                query["hub.mode"] === "subscribe" &&
                constantTimeStringEqual(
                    query["hub.verify_token"] ?? "",
                    config.verifyToken
                );
            if (!(verified && query["hub.challenge"])) {
                return status(403, "Forbidden");
            }
            return query["hub.challenge"];
        },
        {
            query: t.Object({
                "hub.mode": t.Optional(t.String()),
                "hub.verify_token": t.Optional(t.String()),
                "hub.challenge": t.Optional(t.String()),
            }),
            response: {
                200: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/webhook",
        async ({ body, headers }) => {
            const config = readInstagramConfig();
            if (!config) return status(404, "Not Found");
            // The raw text, never re-serialised JSON: Meta signs its exact bytes.
            if (
                !isValidMetaSignature(
                    body,
                    headers["x-hub-signature-256"],
                    config.appSecret
                )
            ) {
                return status(401, "Unauthorized");
            }

            let payload: unknown;
            try {
                payload = JSON.parse(body);
            } catch {
                return status(400, "Bad Request");
            }
            const verification =
                InstagramContext.services.instagramVerification;
            for (const message of extractTextMessages(payload)) {
                const outcome = await verification.handleMessage(message);
                if (outcome !== "no_code") {
                    log.info({ outcome }, "Instagram DM with a link code");
                }
            }
            return "EVENT_RECEIVED";
        },
        {
            parse: "text",
            body: t.String(),
            headers: t.Object({
                "x-hub-signature-256": t.Optional(t.String()),
            }),
            response: {
                200: t.String(),
                400: t.String(),
                401: t.String(),
                404: t.String(),
            },
        }
    );
