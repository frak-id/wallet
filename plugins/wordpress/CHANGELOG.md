# Changelog

All notable changes to the Frak WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release workflow
(`.github/workflows/release-wordpress.yml`) promotes `[Unreleased]` to the new
version on dispatch.

## [Unreleased]

### Added

- Plugin list quick-link: a **Settings** action link now sits next to *Activate / Deactivate* on `wp-admin/plugins.php`, mirroring the WooCommerce convention. Wired through the standard `plugin_action_links_{basename}` filter inside `Frak_Admin::init()` (admin-only context) and points at the existing `options-general.php?page=frak-settings` slug — zero impact on frontend / cron / WP-CLI request paths.

## [1.1.3] - 2026-05-04

### Added

- Native Elementor widget support: Banner, Share Button, and Post-Purchase are now first-class Elementor widgets, surfaced in the panel under a dedicated **Frak** category alongside the existing Gutenberg blocks / `[frak_*]` shortcodes / sidebar widgets.
  - `Frak_Elementor` orchestrator registers the category + widgets through the canonical `elementor/loaded` action so plugin boot order between Frak and Elementor doesn't matter — when Elementor isn't active the action never fires and the integration is a no-op (zero per-request cost).
  - `Frak_Elementor_Widget_Base` (extending `\Elementor\Widget_Base`) holds the shared category / help URL / settings whitelist / SWITCHER → bool helpers, plus a `register_style_controls()` helper that exposes a responsive **Style → Spacing → Margin** control mirroring the `spacing.margin` block support already enabled on the matching Gutenberg blocks.
  - Three concrete widgets (`Frak_Elementor_{Banner,Share_Button,Post_Purchase}_Widget`) declare the Elementor control schema mirroring each block's `block.json` and delegate rendering to the existing `Frak_Component_Renderer` so block / shortcode / sidebar widget / Elementor widget surfaces all emit byte-identical HTML.
  - Every text and textarea control is flagged `'dynamic' => array( 'active' => true )` so Elementor Pro users can wire ACF / Toolset / query parameters / other dynamic data sources into Frak attributes; zero cost when Pro is not active.
  - The renderer's public methods (`banner()`, `share_button()`, `post_purchase()`) gained an opt-in `bool $preview = false` parameter that prepends a bare `preview` HTML attribute on the web component when true — Elementor widgets pass it from `render()` whenever `Frak_Elementor::is_editor_context()` returns true (covers `?action=elementor`, `?elementor-preview=…`, and `action=elementor_ajax` admin-ajax widget renders) so the live preview iframe shows real referral copy without a backend handshake.
  - `<frak-banner>` and `<frak-post-purchase>` need an explicit `preview-mode` / `preview-variant` companion attribute alongside `preview` to know which preview state to paint — without it the web component waits for a runtime context that never arrives in the editor iframe and renders blank (only `<frak-button-share>` paints from `preview` alone). `Frak_Component_Renderer::wrap()` now consults a new `PREVIEW_DEFAULT_ATTRS` constant when `$preview = true` and auto-injects the same `referral` / `referrer` defaults the Gutenberg `editor.js` already emits, so every PHP-rendered preview surface (Elementor today, future REST / page-builder integrations tomorrow) renders the right variant out of the box. Caller-supplied `$preview_overrides` (a 4th opt-in param on `banner()` / `post_purchase()`) take precedence over the constant, which is what powers the new **Editor preview** sections in the Banner and Post-Purchase Elementor widgets: a `previewMode` SELECT (Referral success / In-app browser prompt) on Banner and a `previewVariant` SELECT (Referrer / Referee) on Post-Purchase — byte-for-byte parity with the Gutenberg blocks' *Editor preview* inspector panels. Settings are filtered out before the renderer call when not in editor mode so they never leak as unknown HTML attributes on the published frontend.
  - `Frak_Frontend::generate_config_script()` flips `waitForBackendConfig: false` in the same editor context so the preview-iframe SDK boots without waiting for the merchant dashboard, mirroring the trick `Frak_Blocks::generate_editor_config_script()` already uses for Gutenberg.
  - `Frak_Shortcodes::is_renderable_context()` now whitelists Elementor's editor REST / admin-ajax flows so the existing `[frak_*]` shortcodes also preview cleanly inside Elementor's HTML / Shortcode widget.
  - PHPStan stays green via a new `phpstan-elementor-stubs.php` referenced from `phpstan.neon` `scanFiles` — only the Elementor surface our integration touches is stubbed; production code never loads it (excluded from the `dist/*.zip` via `.distignore`).

### Changed

- `frak/post-purchase`: WooCommerce order context (`customer-id` / `order-id` / `token`) and the optional `products` gallery are now resolved in a single pass through `Frak_WooCommerce::get_post_purchase_data( $with_products, $cap )`, replacing the previous `get_order_context()` + `get_order_products()` pair. Both old methods independently called `resolve_current_order()` — meaning every post-purchase render performed two `is_wc_endpoint_url()` checks, two `wc_get_order()` lookups (one DB hit each on cache miss), and two URL-key / `view_order` capability checks. The new method resolves the `WC_Order` exactly once and returns `array{context, products}`, halving the per-render WC overhead on the thank-you / view-order endpoints. Public API: `get_order_context()` and `get_order_products()` are removed; the renderer is the only caller and was updated in the same change. Endpoint guards live in `resolve_current_order()` unchanged — same `key` URL match on `order-received` and same `view_order` meta-cap check on `view-order`.

- `frak/share-button`: dropped the **Share modal** option from the *Click action* dropdown. The SDK retired its modal-flow share path (`modalBuilder().sharing()`) in favour of the full-page `displaySharingPage` UI — that surface already supports product cards, error handling, and matches the post-purchase share flow, so maintaining a parallel modal path no longer paid for itself. Existing posts / merchant configs that still emit `clickAction="share-modal"` keep working: the SDK component falls through to `openSharingPage` at runtime so the share still opens, just on the full-page surface. Merchants who specifically want the embedded-wallet modal continue to pick **Embedded wallet**, which is unchanged.

- `frak/post-purchase`: when placed on a WooCommerce `order-received` / `view-order` endpoint, the rendered `<frak-post-purchase>` now auto-injects a `products` HTML attribute carrying the order's line items (title, `medium`-size featured image URL, product permalink) so the SDK's full-page sharing UI displays a card for each purchased item instead of a generic share screen. Items are extracted via a new `Frak_WooCommerce::get_order_products( $cap = 6 )` method (sharing the existing endpoint + capability guards via a `resolve_current_order()` private helper, refactored out of `get_order_context()`), JSON-encoded with `wp_json_encode( …, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )`, and `esc_attr()`-escaped before emission. Capped at six items by default to keep attribute serialisation small; deleted-product line items and orders with zero resolvable products fall back to omitting the attribute entirely so the share still works without a product gallery. Variation products inherit the parent's image when no variation-specific media is set (standard WooCommerce behaviour). Side note: the share CTA on this card now routes through the full-page `displaySharingPage` SDK flow (which already supports product cards) instead of the modal-flow share path, which only renders Copy / Share buttons.

- `frak/post-purchase`: added a **Show purchased products** toggle to the *Behaviour* inspector panel (default on) so merchants can opt out of the auto-injected product cards without removing the block. New `showProducts: boolean` block attribute (default `true`); mirrored in `includes/blocks-manifest.php` (the source of truth on WP 6.7+). The renderer's new `Frak_Component_Renderer::should_show_products()` helper trims + lower-cases string inputs and treats `null` / empty string as "unset → default true" so older block instances saved before this attribute existed and shortcodes that pass `show_products=""` keep showing products. Falsy values matched are `false` boolean / `0` integer / `0|false|no|off` strings (whitespace-tolerant). The widget surface intentionally does not expose this toggle: WP's checkbox semantics make a default-true field awkward (an unchecked-yet-saved checkbox would silently disable the cards), and the renderer's default-on behaviour applies regardless.

- `frak/banner`: added a **Disabled** option to the *Editor preview → Preview mode* dropdown. Selecting it swaps the live `<frak-banner preview>` for an empty block wrapper — the block stays selectable via canvas hover and List View so the inspector remains reachable, but no preview UI clutters the canvas. Use case: a banner placed in a header/footer template part that would otherwise show its preview on every post in Gutenberg. Editor-only — frontend rendering and `Frak_Component_Renderer::banner()` output are unchanged.

- `frak/banner`, `frak/post-purchase`, `frak/share-button`: added Gutenberg `spacing.margin` support so merchants can adjust the block-level margin between Frak blocks and surrounding content from the right-sidebar **Styles** panel. Mirrored in `includes/blocks-manifest.php` (the source of truth on WP 6.7+). Color/typography/padding/border supports were intentionally **not** opted into: the SDK web components (`<frak-banner>`, `<frak-post-purchase>`, `<frak-button-share>`) ship hardcoded vanilla-extract styles whose class-level specificity overrides values inherited from the wrapper `<div>`, so enabling those controls would either no-op (color, fontSize) or paint a misleading frame around the already-styled component (background, padding, border). Revisit once the SDK exposes themable CSS custom properties on those components.

- `frak/banner`, `frak/post-purchase`, `frak/share-button`: routed Gutenberg's standard *Advanced → Additional CSS Class(es)* field into the inner web component instead of only the wrapper `<div>`. The merchant-supplied class is now joined onto the `<frak-banner classname="…">` / `<frak-post-purchase classname="…">` / `<frak-button-share classname="…">` HTML attribute, where the SDK forwards it onto the same DOM node that carries the stable BEM hooks (`.frak-banner__title`, `.frak-banner__cta`, `.frak-banner__description`, etc.). Merchant theme CSS targeting `.merchant-class .frak-banner__title { … }` now matches as expected — previously the class only landed on the outer wrapper, beyond the reach of those descendant selectors. Implementation: a new `Frak_Component_Renderer::merge_classnames()` helper merges `attributes.className` into `attributes.classname` at the top of every render method (block render, shortcode, widget) so all three insertion surfaces emit identical output. The custom *CSS class name* TextControl in each block's Advanced inspector panel was removed in favour of the WP-native field — existing posts that stored a value in the legacy `attributes.classname` keep rendering correctly because the renderer joins both. The block editor's live preview now mirrors the same merged value so what merchants see in Gutenberg matches the frontend output.

## [1.1.2] - 2026-04-28

### Added

- Auto-update via the standard WordPress "Plugins → Updates" UI without being listed on wordpress.org. The plugin now watches `frak-id/wallet` GitHub releases through [yahnis-elsts/plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker), filtering by the `wordpress-X.Y.Z` tag namespace and downloading the packaged `frak-integration-X.Y.Z.zip` release asset (with `vendor/` baked in) rather than GitHub's auto-generated source archive. PUC's check runs every 12 h on cron / admin page loads; merchants get the same one-click update flow as wordpress.org-hosted plugins.

## [1.1.1] - 2026-04-23

### Changed

- `frak/share-button`: default click action flipped from `embedded-wallet` to `sharing-page` so the out-of-the-box CTA lands on the hosted sharing page. The click-action override moved to the block's Advanced panel (and to the bottom of the widget form) — merchants rarely need to change it, so it no longer competes with the primary content controls.

- `frak/share-button`: added a `buttonStyle` preset (Primary / Secondary / None) that prepends WordPress core button classes (`wp-element-button`, `wp-block-button__link`, `is-style-outline`) onto the rendered `<button>`. Defaults to `primary` across block, widget, and shortcode surfaces so the share CTA picks up the merchant theme's `theme.json` button styling out of the box instead of rendering with the SDK's bare `.button` fallback. Merchants wanting the legacy look opt out with `buttonStyle => 'none'`.

- All three Gutenberg block editors (`frak/banner`, `frak/post-purchase`, `frak/share-button`) now return `null` from their `attr()` helper instead of `undefined` for empty values. WordPress 6.6/6.7 ships React 18.3, which silently **fails to call `removeAttribute()`** on custom elements when a prop transitions from a set value to `undefined` — the attribute stays stuck in the iframe DOM across re-renders. Passing `null` forces React to remove the attribute. This was corrupting the share button's editor preview: toggling "Show potential reward" off left `use-reward=""` on `<frak-button-share>`, which the web component then read back as a truthy string when computing `useReward`. The `use-reward` attribute itself was additionally switched to a conditional spread (`...( useReward ? { 'use-reward': '' } : {} )`) so the key is entirely absent from the props object when the toggle is off — React 18 can't forget to remove a key that was never set.

- Bridged the Gutenberg iframe canvas for Frak web components. Since WP 6.3, the block editor renders blocks inside a same-origin iframe and only forwards `<style>` / `<link>` tags — never `<script>` — so the `frak-sdk` script enqueued via `enqueue_block_editor_assets` defined custom elements in the outer admin window's `CustomElementRegistry` and never in the iframe's. Result: `<frak-button-share>`, `<frak-banner>`, `<frak-post-purchase>` rendered into the block canvas stayed as `HTMLUnknownElement` and never upgraded — the preview looked like an empty box. Added `includes/blocks/frak-editor-sdk-injector.js` which exposes `window.__frakEditorInjectSdk(hostElement)`; each block's `edit()` calls it from a `useEffect` after mount, walking up from a ref'd wrapper to `ownerDocument.defaultView`. If that window is the iframe (different from the outer window), the helper copies `FrakSetup.config` across the frame boundary and appends the SDK `<script>` to the iframe's `<head>`. Idempotent via a `__frakSdkInjected` flag so a page with three banner blocks doesn't stack three script tags. The SDK's own `loader.js` runs `discover(document.body)` + a MutationObserver in whichever window it loads into, so existing and future `<frak-*>` elements in that iframe upgrade automatically.

- Frontend SDK injection is no longer gated on `wp_is_block_theme()` — the plugin now works on classic themes too. The previous gate was a vestige of the floating wallet button (removed) and no longer serves a purpose: the SDK is enqueued via `wp_enqueue_scripts` with `strategy: defer`, which every well-behaved theme supports. Admin notice + documentation adjusted accordingly.

- Dropped unused `simplito/elliptic-php` dependency (~2.9 MB in the shipped zip).

- Cleaned up `window.FrakSetup` injection to match the current `@frak-labs/components` contract: only `config.metadata` (site name + logo) is emitted; `modalWalletConfig`, `modalConfig`, `modalShareConfig`, per-site modal i18n, and redundant `walletUrl` / `domain` defaults are gone.

- Added proper plugin headers: `Text Domain`, `Domain Path`, `Requires at least`, `Requires PHP`, `License`, `License URI`.

- Switched to WP 6.3+ script loading strategy (`strategy => 'defer'`) and injected inline config with `'before'` so `window.FrakSetup` is populated prior to SDK bootstrap.

- Bundled nine individual `frak_*` options into a single autoloaded `frak_settings` array (one-time migration on first load) to reduce `wp_options` footprint and collapse reads into a single in-memory lookup. `frak_webhook_secret` remains standalone (with autoload forced to `no`) because of its distinct credential semantics. The legacy `frak_webhook_logs` ring buffer option — autoloaded on v1 and no longer written to — is purged from `wp_options` during migration so upgrading installs don't leak dead autoload weight.

- Refactored `Frak_WooCommerce` to a stateless hook container (no instance held in memory between requests).

- Declared WooCommerce HPOS compatibility (`custom_order_tables`) via `before_woocommerce_init`.

- Replaced the hard-coded WooCommerce post-purchase injection with two independent surfaces: a new `frak/post-purchase` Gutenberg block for the UI, and a lightweight inline `trackPurchaseStatus` fallback for attribution. Both recognise the WooCommerce order-received (thank-you, URL-key guarded) and view-order (My Account, `view_order` capability guarded) endpoints, so `customer-id` / `order-id` / `token` are resolved server-side and auto-injected into the block. The inline tracker ALWAYS fires on these endpoints as a failsafe — `trackPurchaseStatus` is idempotent on the same `(customerId, orderId, token)` triple, so the block's web component and the inline fallback can both call it without double-counting. This keeps attribution working when the block is present but the SDK is still warming up, or when the merchant hasn't placed the block at all.

- Dropped jQuery from the admin bundle. `admin/js/admin.js` rewritten in vanilla JS using `fetch`, `URLSearchParams`, and modern DOM APIs.

- Floating wallet button removed entirely. All related settings (`enable_floating_button`, `show_reward`, `button_classname`, `floating_button_position`), admin UI, and `wp_footer` render path are gone. Users place buttons via the new `frak/share-button` Gutenberg block when they want one.

- Per-site modal i18n and language overrides removed from the plugin — these are now driven by the Frak merchant dashboard (`business.frak.id`), keeping the WordPress admin surface focused on what's WP-specific.

- WooCommerce purchase-tracking toggle (`enable_purchase_tracking`) removed. Tracking is now automatic whenever WooCommerce is active; the admin panel just explains when and how it fires.

- Replaced the ad-hoc `frak-integration.php` SPL autoloader with Composer's classmap autoloader. `composer.json` now maps both `includes/` and `admin/`; `build.sh` runs `composer install --optimize-autoloader` so production zips ship a warm classmap and no SPL closures fire per request.

- Settings page CSRF protection: form now emits `wp_nonce_field( Frak_Admin::SETTINGS_NONCE_ACTION )`, and `Frak_Admin::save_settings()` calls `check_admin_referer()` + a second `current_user_can( 'manage_options' )` check before persisting.

- Dropped `image/svg+xml` from the allowed logo upload types (avoids XSS via unsanitized SVG).

- Removed the unused `wp_enqueue_code_editor()` call from the admin settings-page enqueue path.

- Dropped the site-wide `wp_cache_flush()` from the settings save handler — we now only ping page-cache plugins (WP Rocket, W3TC, WP Super Cache) so persistent object caches (Redis, Memcached) are not invalidated on every save.

- Delegated order-status webhook delivery to WooCommerce's native webhook pipeline (`WC_Webhook` + `woocommerce_deliver_webhook_async`). The plugin now creates/updates a single `order.updated` webhook pointing at `https://backend.frak.id/ext/merchant/<id>/webhook/woocommerce`, signed with WC's own `X-WC-Webhook-Signature` (base64 HMAC-SHA256). The `Frak_Webhook_Helper` class, custom HMAC dispatcher, Action Scheduler worker, `frak_dispatch_webhook` action, `woocommerce_order_status_changed` handler, and the ephemeral `wp_cache` log ring buffer were all removed — WooCommerce now owns retry, delivery logging (visible under `WooCommerce → Status → Logs`), and admin visibility under `WooCommerce → Settings → Advanced → Webhooks`. `Frak_WC_Webhook_Registrar::ensure()` now takes a short-lived transient lock and falls back to a name/topic lookup so concurrent admin requests can't spawn duplicate webhook rows, and also watches `update_option_home`/`update_option_siteurl` so domain changes automatically re-point the delivery URL. The `upgrader_process_complete` hook also calls `ensure()` so v1.0 installs (which dispatched webhooks from PHP without ever creating a `WC_Webhook` row) are auto-migrated on plugin update — operators don't have to visit the settings page to keep attribution flowing. The settings page health probe now compares topic, API version, and secret against WooCommerce, surfaces `pending_delivery` and `failure_count`, and renders a "Merchant → Allowed Domains" hint when the domain drifts. `admin/js/admin.js` `postAjax()` is hardened against non-JSON responses (network error, 4xx/5xx, nonce `-1`, missing-action `0`) so button clicks surface a real error notice instead of silently stalling. The backend `/ext/merchant/:id/webhook/woocommerce` handler now acknowledges WooCommerce's unsigned initial `deliver_ping()` (form body `webhook_id=N`) with 200 so new webhooks never get stuck in `pending_delivery=1`, and maps orders carrying any `refunds[]` entries to `refunded` so partial refunds void attribution the same way full refunds do.

- Removed the dead `register_setting()` calls (settings are persisted via the custom nonce-protected handler; registrations were never exercised).

### Added

- New Gutenberg blocks, usable from the block editor on any theme type (classic or block / FSE):
  - `frak/share-button` wraps `<frak-button-share>` (rewards-aware share CTA).
  - `frak/banner` wraps `<frak-banner>` (referral success + in-app browser prompt).
  - `frak/post-purchase` wraps `<frak-post-purchase>` (thank-you card with referrer/referee variants).
    All three are dynamic (`render.php`), attribute-driven, and rely on the globally enqueued SDK — no per-block bundle download.
- `Frak_Blocks` registers every folder under `includes/blocks/` on `init` via a single glob loop, so adding a new block only requires dropping a new folder with `block.json` + `editor.js` + `render.php`.
- Three `[frak_*]` shortcodes (`[frak_banner]`, `[frak_share_button]`, `[frak_post_purchase]`) mirror the blocks for Classic Editor / TinyMCE, page builders (Elementor, Beaver, WPBakery), and theme/plugin authors calling `do_shortcode()` from PHP templates. Snake\_case attribute names map to the same camelCase block attributes; boolean toggles accept `"1" / "true" / "yes" / "on"`.
- Three sidebar widgets (`Frak_Banner_Widget`, `Frak_Share_Button_Widget`, `Frak_Post_Purchase_Widget`) for classic-theme sidebars / footers — also usable from the block-based widget screen via core's Legacy Widget block wrapper. Each widget exposes the same attributes as the matching block via a simple form UI.
- `Frak_Component_Renderer` centralises the block-attr → web-component-HTML mapping so the block `render.php`, the shortcodes, and the widgets all emit byte-identical markup and share the WooCommerce order-context auto-injection logic.

## [1.0.0] - 2026-04-16

### Added

- Initial release of the Frak WordPress plugin.

[Unreleased]: https://github.com/frak-id/wallet/compare/wordpress-1.1.3...HEAD

[1.1.3]: https://github.com/frak-id/wallet/compare/wordpress-1.1.2...wordpress-1.1.3

[1.1.2]: https://github.com/frak-id/wallet/compare/wordpress-1.1.1...wordpress-1.1.2

[1.1.1]: https://github.com/frak-id/wallet/compare/wordpress-1.0.0...wordpress-1.1.1

[1.0.0]: https://github.com/frak-id/wallet/releases/tag/wordpress-1.0.0
