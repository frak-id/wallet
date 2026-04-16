=== Frak ===
Contributors: frak-labs
Tags: rewards, engagement, web3, ecommerce, woocommerce
Requires at least: 5.8
Tested up to: 6.4
Stable tag: 1.0
Requires PHP: 8.3
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Frak integration plugin - Adds reward and engagement features to your WordPress site.

== Description ==

The Frak plugin integrates the Frak SDK into your WordPress site, enabling:

* User rewards and engagement tracking
* Floating wallet button for easy access
* WooCommerce purchase tracking integration
* Customizable configuration through WordPress admin

== Installation ==

1. Upload the `frak-integration` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Configure the plugin settings under Settings > Frak

== Configuration ==

After activation:

1. Navigate to Settings > Frak in your WordPress admin
2. Configure your App Name and Logo URL
3. Enable desired features (floating button, purchase tracking)
4. Customize the advanced configuration as needed
5. Save your settings

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

No, the plugin works without WooCommerce. The purchase tracking feature is optional and only activates if WooCommerce is installed.

= Can I customize the button position? =

Yes, you can set the button position to "left" or "right" in the advanced configuration settings.

= Is the floating button shown on all pages? =

The floating button can be enabled/disabled globally from the settings page.

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
