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
	 *
	 * Deactivation cleanup is registered directly in the main plugin file
	 * (see `register_deactivation_hook()` there) — no second registration
	 * from here is needed.
	 */
	public static function boot() {
		add_action( 'init', array( __CLASS__, 'init' ) );
	}

	/**
	 * Plugin init callback.
	 *
	 * Detects the runtime context up-front so the per-request cost stays
	 * minimal:
	 *   - WP-CLI / cron: only the webhook registrar is wired — its
	 *     option-update hooks keep the WC webhook in sync when
	 *     `wp option update frak_webhook_secret` or a domain change runs
	 *     from the CLI, or when cron mutates those options. Frontend SDK
	 *     injection, admin UI, and block registration are irrelevant.
	 *   - Admin: settings UI + webhook registrar (the only context that
	 *     actually mutates `frak_webhook_secret` / `frak_merchant` /
	 *     `home` / `siteurl` — registering those 6 option-update hooks on
	 *     every frontend request was dead weight).
	 *   - Frontend: SDK injection (block theme only), blocks, WC tracker.
	 */
	public static function init() {
		$has_wc = class_exists( 'WooCommerce' );

		if ( ( defined( 'WP_CLI' ) && WP_CLI ) || wp_doing_cron() ) {
			if ( $has_wc ) {
				Frak_WC_Webhook_Registrar::init();
			}
			return;
		}

		$is_block_theme = wp_is_block_theme();

		if ( is_admin() ) {
			Frak_Admin::init();

			if ( ! $is_block_theme ) {
				add_action( 'admin_notices', array( __CLASS__, 'render_block_theme_notice' ) );
			}

			if ( $has_wc ) {
				Frak_WC_Webhook_Registrar::init();
			}
		} elseif ( $is_block_theme ) {
			Frak_Frontend::init();
		}

		Frak_Blocks::init();

		if ( $has_wc ) {
			Frak_WooCommerce::init();
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
}
