/**
 * Wallet favorites event map.
 *
 * Sourced from the brand favorites feature in `apps/wallet` (Explorer heart
 * toggle + profile favorites list). Measures whether users actually favorite
 * brands — the page visit itself is already covered by OpenPanel's route
 * `screen_view` auto-tracking, so only the toggle needs explicit instrumentation.
 *
 * `favorite_toggled` fires once per toggle from the favorites store, the single
 * choke point every call site routes through. `action` distinguishes adds from
 * removes so a net favorites signal can be derived.
 */
export type FavoritesEventMap = {
    favorite_toggled: {
        merchant_id: string;
        action: "add" | "remove";
    };
};
