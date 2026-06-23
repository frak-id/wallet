/**
 * Wallet explorer event map.
 *
 * Sourced from the `/explorer` route in `apps/wallet`. Used by the
 * business dashboard funnel as the per-merchant impressions denominator
 * — replaces the legacy `screen_view` + `path startsWith /explorer`
 * proxy which could not be scoped to a merchant.
 *
 * `explorer_card_viewed` is fired once per `ExplorerCard` mount when the
 * card first crosses the viewport visibility threshold. Repeat views in
 * the same scroll session are intentionally not counted; the observer
 * disconnects after the first hit.
 */
export type ExplorerEventMap = {
    explorer_card_viewed: {
        merchant_id: string;
    };
};
