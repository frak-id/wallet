<?php
/**
 * Main plugin controller.
 *
 * Stateless static class — mirrors the pattern used by {@see Frak_WooCommerce}
 * and {@see Frak_WC_Webhook_Registrar}. {@see boot()} wires the bootstrap
 * hooks on `plugins_loaded`; everything else is a static callback.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Plugin
 */
class Frak_Plugin {

	/**
	 * Wire the bootstrap hooks. Called once from `plugins_loaded` in
	 * `frak-integration.php`.
	 */
	public static function boot() {
		register_deactivation_hook( FRAK_PLUGIN_FILE, array( __CLASS__, 'deactivate' ) );

		add_action( 'init', array( __CLASS__, 'init' ) );
	}

	/**
	 * Plugin init callback.
	 */
	public static function init() {
		// WP-CLI keeps only the webhook registrar wired — its option-update hooks
		// keep the WC webhook in sync when `wp option update frak_webhook_secret`
		// or a domain change is executed from the CLI. Frontend SDK injection,
		// admin UI, and block registration are irrelevant for CLI invocations.
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			if ( class_exists( 'WooCommerce' ) ) {
				Frak_WC_Webhook_Registrar::init();
			}
			return;
		}

		// In cron, only the webhook registrar needs to stay wired — its
		// option-update hooks keep the WC webhook in sync if a cron job mutates
		// `frak_webhook_secret` / `frak_merchant`. The tracker hooks fire only
		// on order-received / view-order frontend requests, and admin UI +
		// frontend enqueues are dead weight here.
		if ( wp_doing_cron() ) {
			if ( class_exists( 'WooCommerce' ) ) {
				Frak_WC_Webhook_Registrar::init();
			}
			return;
		}

		if ( is_admin() ) {
			Frak_Admin::init();

			if ( ! wp_is_block_theme() ) {
				add_action( 'admin_notices', array( __CLASS__, 'render_block_theme_notice' ) );
			}
		} elseif ( wp_is_block_theme() ) {
			Frak_Frontend::init();
		}

		Frak_Blocks::init();

		if ( class_exists( 'WooCommerce' ) ) {
			Frak_WooCommerce::init();
			Frak_WC_Webhook_Registrar::init();
		}
	}

	/**
	 * Admin notice shown when the active theme is not a block theme.
	 */
	public static function render_block_theme_notice() {
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Frak requires a block theme to inject the SDK on the frontend. The settings page is still available, but the Frak SDK will not load on your site until you activate a block theme.', 'frak' );
		echo '</p></div>';
	}

	/**
	 * Plugin deactivation.
	 */
	public static function deactivate() {
		// Cleanup if needed.
	}
}
