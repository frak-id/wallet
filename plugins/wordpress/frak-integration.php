<?php
/**
 * Plugin Name: Frak
 * Plugin URI: https://docs.frak.id/components/frak-setup
 * Description: Adds Frak configuration to your WordPress site. Requires a block theme.
 * Version: 1.0.0
 * Requires at least: 6.4
 * Requires PHP: 8.3
 * Author: Frak-Labs
 * Author URI: https://frak.id
 * License: GPL-3.0-only
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: frak
 * Domain Path: /languages
 *
 * @package Frak_Integration
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'FRAK_PLUGIN_FILE', __FILE__ );
define( 'FRAK_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'FRAK_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load Composer autoloader if it exists.
if ( file_exists( FRAK_PLUGIN_DIR . 'vendor/autoload.php' ) ) {
	require_once FRAK_PLUGIN_DIR . 'vendor/autoload.php';
}

// Load the main plugin class.
require_once FRAK_PLUGIN_DIR . 'includes/class-frak-plugin.php';
require_once FRAK_PLUGIN_DIR . 'includes/class-frak-webhook-helper.php';

/**
 * Initialize the plugin.
 */
function frak_init() {
	Frak_Plugin::instance();
}
add_action( 'plugins_loaded', 'frak_init' );

/**
 * Declare compatibility with WooCommerce High-Performance Order Storage (HPOS / custom order tables).
 */
add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', FRAK_PLUGIN_FILE, true );
		}
	}
);
