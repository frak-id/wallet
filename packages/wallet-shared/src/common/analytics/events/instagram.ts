/**
 * Instagram connect page, from `apps/wallet/app/module/instagram`.
 * Declarations, links and follow checks are tracked server-side; these cover
 * the intent and drop-off the server never sees.
 */
export type InstagramEventMap = {
    instagram_page_viewed: {
        level: "none" | "declared" | "certified";
        /** `null` without a link. */
        follows: boolean | null;
    };
    instagram_dm_opened: undefined;
    /** One per settled check of the DM; `retry` is the "check again" button. */
    instagram_dm_checked: {
        outcome: "linked" | "not_received" | "error";
        retry: boolean;
    };
    /** The typed-handle form was opened from its link. */
    instagram_declare_opened: undefined;
};
