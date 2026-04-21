=== Frak ===
Contributors: frak-labs
Tags: rewards, engagement, web3, ecommerce, woocommerce
Requires at least: 6.4
Tested up to: 6.8
Stable tag: 1.1
Requires PHP: 8.0
License: GPL-3.0-only
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Frak integration plugin — adds reward, referral, and engagement features to your WordPress site. Works with classic and block themes.

== Description ==

The Frak plugin integrates the Frak SDK into your WordPress site and ships three components, each exposed as a Gutenberg block, a shortcode, and a sidebar widget — so they drop into any post, page, template part, widget area, or page-builder layout:

* **Frak Share Button** (`frak/share-button`, `[frak_share_button]`) — a share-and-earn CTA placed wherever you want.
* **Frak Banner** (`frak/banner`, `[frak_banner]`) — a notification banner that handles referral success and in-app browser prompts. Auto-hides when not needed.
* **Frak Post-Purchase** (`frak/post-purchase`, `[frak_post_purchase]`) — a thank-you card with referrer / referee variants. Auto-populates WooCommerce order context on the thank-you page.

When WooCommerce is active, the plugin also wires a native WooCommerce webhook (`order.updated`) that ships order events to the Frak backend for reward attribution. Delivery, retries, and logs are handled by WooCommerce's own webhook pipeline (visible under **WooCommerce → Status → Logs**).

== Installation ==

1. Upload the `frak-integration` folder to the `/wp-content/plugins/` directory (or install the packaged zip from your dashboard).
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Configure the plugin under **Settings → Frak**.
4. Add Frak components to your site via Gutenberg blocks (block editor), `[frak_*]` shortcodes (Classic Editor / page builders / PHP templates), or the sidebar widgets (**Appearance → Widgets**).

== Configuration ==

After activation:

1. Open **Settings → Frak**.
2. Set your **App Name** and **Logo URL** (defaults to your site name + site icon).
3. Register your site's domain in your Frak business dashboard at https://business.frak.id under **Merchant → Allowed Domains**.
4. In the dashboard, generate or copy your **webhook secret** from **Merchant → Purchase Tracker → WooCommerce**.
5. Paste the secret into the **Webhook Secret** field on the WordPress admin page and click **Save Settings**.
6. If WooCommerce is active and the merchant resolved correctly, click **Set up webhook** in the WooCommerce Webhook section. You should see a green ✓ banner.
7. Place the Frak components where you want them — as blocks via the block editor / Site Editor, as shortcodes in classic posts, or as widgets in your theme sidebars.

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

No. The plugin works without WooCommerce — you can still use the Frak blocks for sharing and referral surfaces. WooCommerce is only required for automatic purchase tracking and order-status webhooks.

= Does this plugin require a block theme? =

No. The plugin works on both classic and block themes. The SDK is enqueued via the standard `wp_enqueue_scripts` pipeline, and every Frak component is available as a Gutenberg block, a shortcode, and a sidebar widget — use whichever surface fits your theme.

= How do I insert a Frak component in the Classic Editor / TinyMCE? =

Use the matching shortcode. Attribute names are snake_case and mirror the block attributes:

* `[frak_banner placement="top" referral_title="Welcome back!" referral_cta="Claim"]`
* `[frak_share_button text="Share & earn" use_reward="1" button_style="primary" click_action="share-modal"]`
* `[frak_post_purchase variant="referrer" cta_text="Share now"]`

= How do I add a Frak component to a classic-theme sidebar or footer? =

Go to **Appearance → Widgets** and add one of: **Frak Banner**, **Frak Share Button**, or **Frak Post-Purchase** to the target widget area. The widgets mirror the block attributes in a simple form UI.

= Where do I get my webhook secret? =

In your Frak business dashboard at https://business.frak.id, navigate to **Merchant → Purchase Tracker → WooCommerce** and generate or copy the secret. The plugin no longer generates the secret locally — the dashboard is the source of truth.

= My WooCommerce webhook stopped delivering. What do I do? =

Open **Settings → Frak**. The WooCommerce Webhook section will tell you exactly what's wrong (merchant unresolved, domain drift, secret mismatch, topic edited, etc.) and which button to click to fix it. Delivery logs are under **WooCommerce → Status → Logs** with source `webhooks-delivery`.

= I changed my site's domain. What do I do? =

Add the new domain to **Merchant → Allowed Domains** in your Frak dashboard, then click **Refresh Merchant** on the Frak settings page. The webhook URL is automatically re-pointed when the domain changes.

= I'm upgrading from v1.0. Anything I should know? =

Yes — please read the **Upgrade Notice** for the full list. The short version: customise your modal copy on the Frak dashboard (per-site i18n overrides are gone), and place the new Frak blocks where you want them in the Site Editor (the floating wallet button is removed).

== Changelog ==

See changelog for detailed changes.

= 1.0 =
* Refactored plugin architecture for better maintainability
* Simplified SDK injection - removed file caching
* Improved code organization with separate classes
* Enhanced WooCommerce integration

= 0.7 =
* Initial release

== Upgrade Notice ==

= 1.1 =
Major refactoring for improved performance and maintainability. Please review your settings after updating.
