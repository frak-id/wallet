import { log } from "@backend-infrastructure/external/logger";
import ky, { type KyInstance } from "ky";

export type SlackMessage = {
    /** Channel name (without `#`) or id; the bot must be a member. */
    channel: string;
    /** Notification + fallback text; Slack shows it wherever blocks cannot render. */
    text: string;
    blocks?: unknown[];
};

/** Slack always answers HTTP 200: `ok` carries the real outcome. */
type SlackResponse = {
    ok: boolean;
    error?: string;
};

/**
 * Thin `chat.postMessage` adapter. Never throws: a notification must not fail
 * the request that triggered it, so every failure is logged and reported as `false`.
 */
export class SlackClient {
    private readonly api?: KyInstance;

    constructor(token = process.env.SLACK_BOT_TOKEN) {
        if (!token) return;
        this.api = ky.create({
            prefix: "https://slack.com/api",
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10_000,
        });
    }

    async postMessage(message: SlackMessage): Promise<boolean> {
        if (!this.api) {
            log.info(
                { channel: message.channel },
                "Slack not configured, skipping message"
            );
            return false;
        }
        try {
            const response = await this.api
                .post("chat.postMessage", { json: message })
                .json<SlackResponse>();
            if (!response.ok) {
                log.error(
                    { channel: message.channel, slackError: response.error },
                    "Slack rejected the message"
                );
            }
            return response.ok;
        } catch (err) {
            log.error(
                { err, channel: message.channel },
                "Slack message failed"
            );
            return false;
        }
    }
}

export const slackClient = new SlackClient();
