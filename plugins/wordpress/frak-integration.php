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

// Load Composer autoloader if it exists.
if ( file_exists( plugin_dir_path( __FILE__ ) . 'vendor/autoload.php' ) ) {
	require_once plugin_dir_path( __FILE__ ) . 'vendor/autoload.php';
}

// Load the main plugin class.
require_once plugin_dir_path( __FILE__ ) . 'includes/class-frak-plugin.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-frak-webhook-helper.php';

/**
 * Initialize the plugin.
 */
function frak_init() {
	Frak_Plugin::instance();
}
add_action( 'plugins_loaded', 'frak_init' );
