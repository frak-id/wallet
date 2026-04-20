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
	 *   - Frontend: SDK injection, blocks, shortcodes, widgets, WC tracker.
	 *
	 * Blocks, shortcodes and widgets are registered in every non-CLI context
	 * (admin + frontend) so the block editor iframe, TinyMCE shortcode
	 * resolution and the widget admin screen all see the same set of
	 * insertion surfaces. The SDK itself loads on the frontend regardless of
	 * theme type — the previous `wp_is_block_theme()` gate was a vestige of
	 * the now-removed floating wallet button and is no longer needed: modern
	 * classic themes call `wp_footer()` reliably and the SDK is enqueued via
	 * the standard `wp_enqueue_scripts` pipeline with `strategy: defer`.
	 */
	public static function init() {
		$has_wc = class_exists( 'WooCommerce' );

		if ( ( defined( 'WP_CLI' ) && WP_CLI ) || wp_doing_cron() ) {
			if ( $has_wc ) {
				Frak_WC_Webhook_Registrar::init();
			}
			return;
		}

		if ( is_admin() ) {
			Frak_Admin::init();

			if ( $has_wc ) {
				Frak_WC_Webhook_Registrar::init();
			}
		} else {
			Frak_Frontend::init();
		}

		Frak_Blocks::init();
		Frak_Shortcodes::init();
		Frak_Widgets::init();

		if ( $has_wc ) {
			Frak_WooCommerce::init();
		}
	}
}
