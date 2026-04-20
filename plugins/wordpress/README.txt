=== Frak ===
Contributors: frak-labs
Tags: rewards, engagement, web3, ecommerce, woocommerce
Requires at least: 6.4
Tested up to: 6.8
Stable tag: 1.1
Requires PHP: 8.0
License: GPL-3.0-only
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Frak integration plugin — adds reward, referral, and engagement features to your WordPress site. Requires a block theme.

== Description ==

The Frak plugin integrates the Frak SDK into your WordPress site and ships three Gutenberg blocks for the most common reward surfaces:

* **Frak Share Button** (`frak/share-button`) — a share-and-earn CTA placed wherever you want.
* **Frak Banner** (`frak/banner`) — a notification banner that handles referral success and in-app browser prompts. Auto-hides when not needed.
* **Frak Post-Purchase** (`frak/post-purchase`) — a thank-you card with referrer / referee variants. Auto-populates WooCommerce order context on the thank-you page.

When WooCommerce is active, the plugin also wires a native WooCommerce webhook (`order.updated`) that ships order events to the Frak backend for reward attribution. Delivery, retries, and logs are handled by WooCommerce's own webhook pipeline (visible under **WooCommerce → Status → Logs**).

== Installation ==

1. Upload the `frak-integration` folder to the `/wp-content/plugins/` directory (or install the packaged zip from your dashboard).
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Make sure a **block theme** is active (required for frontend SDK injection).
4. Configure the plugin under **Settings → Frak**.

== Configuration ==

After activation:

1. Open **Settings → Frak**.
2. Set your **App Name** and **Logo URL** (defaults to your site name + site icon).
3. Register your site's domain in your Frak business dashboard at https://business.frak.id under **Merchant → Allowed Domains**.
4. In the dashboard, generate or copy your **webhook secret** from **Merchant → Purchase Tracker → WooCommerce**.
5. Paste the secret into the **Webhook Secret** field on the WordPress admin page and click **Save Settings**.
6. If WooCommerce is active and the merchant resolved correctly, click **Set up webhook** in the WooCommerce Webhook section. You should see a green ✓ banner.
7. Place the Frak blocks where you want them via the Site Editor (FSE).

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

No. The plugin works without WooCommerce — you can still use the Frak blocks for sharing and referral surfaces. WooCommerce is only required for automatic purchase tracking and order-status webhooks.

= Does this plugin require a block theme? =

Yes. Frak only injects its SDK on block themes (Full Site Editing). The settings page still works on classic themes, but no SDK loads on the frontend until a block theme is activated.

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
