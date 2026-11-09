/** Native store rating prompt, from `apps/wallet/app/module/common/utils/maybeAskForReview.ts`. */
export type ReviewEventMap = {
    store_review_requested: {
        trigger: "game_win" | "game_tickets" | "game_joined" | "app_launch";
    };
};
