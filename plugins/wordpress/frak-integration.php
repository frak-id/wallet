<?php
/**
 * Plugin Name: Frak
 * Description: Adds Frak configuration to your WordPress site
 * Version: 1.0
 * Author: Frak-Labs
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
