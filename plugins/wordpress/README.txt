=== Frak ===
Contributors: frak-labs
Tags: rewards, engagement, web3, ecommerce, woocommerce
Requires at least: 6.4
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 8.3
License: GPL-3.0-only
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Frak integration plugin — adds reward and engagement features to your WordPress site. Requires a block theme.

== Description ==

The Frak plugin integrates the Frak SDK into your WordPress site, enabling:

* User rewards and engagement tracking
* Floating wallet button for easy access
* WooCommerce purchase tracking integration
* Customizable configuration through WordPress admin

== Installation ==

1. Upload the `frak-integration` folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Make sure a **block theme** is active (required for frontend injection).
4. Configure the plugin settings under Settings > Frak.
== Configuration ==

After activation:

1. Navigate to Settings > Frak in your WordPress admin
2. Configure your App Name and Logo URL
3. Enable desired features (floating button, purchase tracking)
4. Customize the advanced configuration as needed
5. Save your settings

== Frequently Asked Questions ==
= Does this plugin require WooCommerce? =

No. The plugin works without WooCommerce. The purchase tracking feature is optional and only activates if WooCommerce is installed.

= Does this plugin require a block theme? =

Yes. Frak only injects its SDK on block themes (Full Site Editing). The settings page still works on classic themes, but no SDK will load on the frontend until a block theme is activated.

= Can I customize the button position? =

Yes, you can set the floating wallet button position to "left" or "right" in the settings.

= Is the floating button shown on all pages? =

Yes when enabled. It is injected via `wp_footer` on every frontend page.

== Changelog ==

= 1.0 =
* Refactored plugin architecture for better maintainability
* Simplified SDK injection - removed file caching
* Improved code organization with separate classes
* Enhanced WooCommerce integration

= 0.7 =
* Initial release

== Upgrade Notice ==

= 1.0 =
Major refactoring for improved performance and maintainability. Please review your settings after updating.
