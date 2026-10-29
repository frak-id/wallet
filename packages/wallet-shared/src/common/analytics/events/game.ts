/**
 * Frak Game event map, sourced from `apps/wallet/app/module/game`.
 * Joins, signups, unlocks and Instagram links are tracked server-side,
 * where the write happens; these cover what only the wallet sees.
 */
export type GameEventMap = {
    game_code_entry_viewed: { prefilled: boolean };
    game_code_submitted: {
        outcome: "joined" | "referrer_set" | "error";
        error_key?: string;
    };
    game_page_viewed: {
        game_id: string;
        tickets: number;
        eligible: boolean;
        instagram: "certified" | "declared" | "none";
        missions_done: number;
        tickets_join: number;
        tickets_instagram_certified: number;
        tickets_purchase: number;
        tickets_referred_purchase: number;
        tickets_referred_signup: number;
        tickets_brand_share: number;
    };
    game_mission_clicked: {
        mission: "instagram" | "friend" | "purchase";
        status: "done" | "todo" | "gate";
        surface: "game_page" | "home_card";
        game_id: string;
    };
    /** The home ticket card's main button; the status line fires `game_mission_clicked` instead. */
    game_card_clicked: { game_id: string; participating: boolean };
    game_progress_shown: { tickets_gained: number; unlocked: boolean };
    game_result_viewed: {
        game_id: string;
        outcome:
            | "drawing"
            | "pending_verification"
            | "won"
            | "lost"
            | "no_winner";
        record: "first" | "new" | "tied" | "held";
    };
    game_win_screen_viewed: { game_id: string; prize_amount: number };
    game_win_screen_closed: { game_id: string; action: "history" | "close" };
    frak_referrer_replace_prompted: undefined;
    frak_referrer_replace_resolved: { outcome: "confirmed" | "cancelled" };
};
