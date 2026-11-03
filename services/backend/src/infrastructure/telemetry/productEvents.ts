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
    instagram_declared: Record<string, never>;
    instagram_linked: { follows: boolean };
    instagram_follow_verified: Record<string, never>;
    game_draw_frozen: {
        game_id: string;
        participants: number;
        eligible_participants: number;
        total_tickets: number;
        drand_round: number;
    };
    game_draw_run: { game_id: string; candidates: number };
    game_candidate_window_started: { game_id: string; rank: number };
    game_winner_rejected: { game_id: string; rank: number; reason: string };
    game_winner_confirmed: {
        game_id: string;
        rank: number;
        prize_amount: number;
    };
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
    /** Fire and forget: no-op without a write client, never throws into the caller. `null` = no player behind it. */
    track<K extends keyof ProductEventMap>(
        name: K,
        identityGroupId: string | null,
        properties: ProductEventMap[K]
    ): void {
        client ??= createClient();
        if (!client) return;
        const profile = identityGroupId
            ? { identity_group_id: identityGroupId }
            : {};
        client
            .post("track", {
                json: {
                    type: "track",
                    payload: {
                        name,
                        ...(identityGroupId && { profileId: identityGroupId }),
                        properties: {
                            ...properties,
                            ...profile,
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
