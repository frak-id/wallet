/**
 * Settings → Share Link
 *
 * Surfaces the merchant's `?frakAction=share` URL plus copy-paste snippets
 * for native Shopify Notifications, Klaviyo, and plain HTML email tools.
 *
 * The auto-trigger is implemented in `sdk/components/src/utils/initFrakSdk.ts`:
 * a `?frakAction=share` query param on any storefront page → SDK opens the
 * sharing modal → the param is stripped via `history.replaceState` so refresh
 * doesn't re-fire.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *   Tier 2 — Per-customer URLs (deferred, depends on `frakData` SDK payload)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Once `sdk/core` exposes the compressed `frakData` query param (see questions
 * answered in PR adding the auto-action trigger), the email link evolves from
 * `?frakAction=share` (same URL for everyone) to
 * `?frakAction=share&frakData=<base64-compressed-json>` (per-customer).
 *
 * Wiring required at that point:
 *
 *   1. Customer metafield: `frak.share_token` (namespace `frak`, key
 *      `share_token`). Store the compressed payload — link, products, ref —
 *      generated at order/customer creation time.
 *
 *   2. Webhook hook: `customers/create` and `orders/create` →
 *      `app/services.server/shareTokenService.ts` mints the payload via the
 *      `buildAutoActionUrl` helper from `sdk/core` and writes the metafield.
 *
 *   3. Klaviyo native sync: customer metafields surface as profile properties
 *      automatically when the merchant enables the integration. Their template
 *      becomes:
 *        <a href="{{ organization.url }}?frakAction=share&frakData={{ person.frak_share_token }}">
 *
 *   4. Shopify Liquid template (Order Confirmation) becomes:
 *        <a href="{{ shop.url }}?frakAction=share&frakData={{ customer.metafields.frak.share_token }}">
 *
 *   5. The `<ShareLink>` component above grows a "preview" mode: when the
 *      merchant has Tier 2 enabled, the snippets switch to the metafield-aware
 *      versions automatically.
 *
 * No backend infra change is required — Shopify metafields + Klaviyo's
 * existing sync + the SDK's `frakData` parser cover the whole path.
 */

import { ShareLink } from "app/components/ShareLink";
import type { loader as rootLoader } from "app/routes/app";
import { useRouteLoaderData } from "react-router";

export default function SettingsSharePage() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const shopUrl =
        rootData?.shop.primaryDomain?.url ?? rootData?.shop.url ?? "";

    return <ShareLink shopUrl={shopUrl} />;
}
