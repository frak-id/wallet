# Changelog

All notable changes to the Frak PrestaShop module are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release workflow
(`.github/workflows/release-prestashop.yml`) promotes `[Unreleased]` to the new
version on dispatch.

## [Unreleased]

### Fixed

- **Webhook signature format**: send `base64_encode(hash_hmac('sha256', $body, $secret, true))` (raw bytes, base64-encoded) instead of the default hex digest, matching the backend's `Buffer.from(sig, 'base64')` decode in `validateBodyHmac`. Hex signatures decoded to a 64-byte buffer (vs the expected 32-byte raw digest) and silently failed verification on every dispatch.
- **Webhook endpoint URL**: switch from `/ext/merchant/{id}/webhook/prestashop` (which was never registered on the backend and 404’d every request) to `/ext/merchant/{id}/webhook/custom`, the existing route whose DTO already matches the PrestaShop payload shape.

### Changed

- **Order status hook**: switch from `actionOrderStatusUpdate` (pre-commit, raced under multistore / high load) to `actionOrderStatusPostUpdate` (post-commit), per the official PrestaShop docs.
- **Webhook timeouts**: tighten cURL request timeout to 5 s and connect timeout to 3 s (was 30 s / 10 s). Worst-case delay on the merchant’s checkout path is now bounded; failures hit the retry queue instead.

### Added

- **Async webhook retry queue** (`FrakWebhookQueue` + `FrakWebhookCron`): the order hook attempts a synchronous send with tight timeouts; any failure (network, non-2xx, exception) is enqueued into a custom `{prefix}frak_webhook_queue` table and retried by a cron drainer with exponential backoff (5 min → 24 h, 5 attempts max). Idempotent re-delivery via the backend’s `(merchantId, externalId, status)` dedupe key.
- **Cron front controller** (`controllers/front/cron.php`): token-guarded (`hash_equals` against `FRAK_CRON_TOKEN`) endpoint that drains the retry queue per tick. The full URL is shown on the admin configuration page so the merchant can wire it into `ps_cronjobs` or a server-level cron job.
- **Settings migrator**: existing installs auto-provision the queue table, generate `FRAK_CRON_TOKEN`, and re-register from the old `actionOrderStatusUpdate` hook to `actionOrderStatusPostUpdate` on first request after upgrade (rolled into the existing v2 settings bump).
- **Initial release of the Frak PrestaShop module.**
- Post-purchase tracker: inline `<script>` fires `window.FrakSetup.core.trackPurchaseStatus({customerId, orderId, token})` on the order-confirmation and customer order-detail pages, with a `frak:client` event fallback for the SDK-not-yet-ready race. Mirrors the WordPress `Frak_WooCommerce::render_purchase_tracker_for_order` flow.
- Post-purchase component: `<frak-post-purchase>` now auto-receives `products` (JSON-encoded line items: title / image URL / product link, capped at 6) on the order-confirmation page so the sharing UI can render product cards out of the box.
- New hook `displayOrderDetail`: customer My-Account → Orders → Detail page now renders the same `<frak-post-purchase>` + tracker pair, keeping attribution working when the merchant lands on the order via the post-checkout email link.
- New `views/templates/hook/post-purchase.tpl` Smarty partial: theme-overridable wrapper for the post-purchase markup. Override path: `themes/<theme>/modules/frakintegration/views/templates/hook/post-purchase.tpl`.
- New `FrakOrderResolver` class: single-pass extraction of customer/order/token context plus product line items from a resolved `Order`, fail-soft on missing images / deleted products. Sibling of the WordPress `Frak_WooCommerce::get_post_purchase_data()` helper.

[unreleased]: https://github.com/frak-id/wallet/commits/main/plugins/prestashop
