import { log } from "@backend-infrastructure/external/logger";
import ky, { type KyInstance } from "ky";

/** Server-side product events, sent to the wallet's OpenPanel project. */
export type ProductEventMap = {
    game_joined: {
        game_id: string;
        source: "game_code" | "friend_signup";
        newcomer: boolean;
    };
    referral_signup_completed: { referrer_identity_group_id: string };
    game_reward_unlocked: { recipient_type: string };
    instagram_linked: { follows: boolean };
    instagram_follow_verified: Record<string, never>;
};

function createClient(): KyInstance | null {
    const url = process.env.OPEN_PANEL_API_URL;
    const clientId = process.env.OPEN_PANEL_TRACK_CLIENT_ID;
    const clientSecret = process.env.OPEN_PANEL_TRACK_CLIENT_SECRET;
    if (!(url && clientId && clientSecret)) return null;
    return ky.create({
        prefix: url.replace(/\/+$/, ""),
        headers: {
            "openpanel-client-id": clientId,
            "openpanel-client-secret": clientSecret,
        },
        timeout: 5_000,
        retry: { limit: 1, statusCodes: [429, 503] },
    });
}

let client: KyInstance | null | undefined;

export const productEvents = {
    /** Fire and forget: no-op without a write client, never throws into the caller. */
    track<K extends keyof ProductEventMap>(
        name: K,
        identityGroupId: string,
        properties: ProductEventMap[K]
    ): void {
        client ??= createClient();
        if (!client) return;
        client
            .post("track", {
                json: {
                    type: "track",
                    payload: {
                        name,
                        profileId: identityGroupId,
                        properties: {
                            ...properties,
                            identity_group_id: identityGroupId,
                            source_surface: "backend",
                        },
                    },
                },
            })
            .catch((err) =>
                log.warn({ err, event: name }, "Product event not sent")
            );
    },
};
