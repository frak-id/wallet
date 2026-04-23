<?php
/**
 * Frontend functionality.
 *
 * Stateless static class — follows the same pattern as {@see Frak_WooCommerce}
 * and {@see Frak_WC_Webhook_Registrar}. All handlers are static so no
 * instance is held in memory between requests.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Frontend
 */
class Frak_Frontend {

	/**
	 * Register frontend hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_scripts' ), 20 );
		add_filter( 'wp_resource_hints', array( __CLASS__, 'add_resource_hints' ), 10, 2 );
	}

	/**
	 * Enqueue frontend scripts.
	 *
	 * Always loaded on frontend requests (classic + block themes): the SDK
	 * pulls its real metadata (merchant name, reward UI copy, etc.) from the
	 * Frak backend once the merchant is registered on business.frak.id, so
	 * the plugin must inject the script even when no WP-side `app_name` /
	 * `logo_url` is configured. {@see generate_config_script()} falls back
	 * to `get_bloginfo('name')` so `window.FrakSetup.config.metadata.name`
	 * is never empty.
	 */
	public static function enqueue_scripts() {
		wp_enqueue_script(
			'frak-sdk',
			'https://cdn.jsdelivr.net/npm/@frak-labs/components',
			array(),
			null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters -- CDN serves latest version; avoid ?ver= query param.
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);

		// Inline config injected 'before' the SDK so window.FrakSetup is populated prior to SDK bootstrap.
		wp_add_inline_script( 'frak-sdk', self::generate_config_script(), 'before' );
	}

	/**
	 * Append DNS-prefetch / preconnect hints for the SDK origin so the
	 * browser can warm the TLS handshake before the `<script>` tag parses.
	 *
	 * @param array<int, string|array<string, string>> $hints    Existing hints from core.
	 * @param string                                   $relation Relation type being filtered.
	 * @return array<int, string|array<string, string>>
	 */
	public static function add_resource_hints( $hints, $relation ) {
		if ( 'dns-prefetch' === $relation ) {
			$hints[] = 'https://cdn.jsdelivr.net';
		}
		if ( 'preconnect' === $relation ) {
			$hints[] = array(
				'href'        => 'https://cdn.jsdelivr.net',
				'crossorigin' => 'anonymous',
			);
		}
		return $hints;
	}

	/**
	 * Generate the inline configuration script for window.FrakSetup.
	 *
	 * Shape matches the current SDK contract (see @frak-labs/components):
	 *   window.FrakSetup = { config: FrakWalletSdkConfig };
	 *
	 * Only the site-level metadata (name + logoUrl) is emitted — every other
	 * knob is either SDK-default or merchant-dashboard driven.
	 *
	 * @return string
	 */
	private static function generate_config_script() {
		$app_name_raw = Frak_Settings::get( 'app_name' );
		$app_name     = '' !== $app_name_raw ? $app_name_raw : get_bloginfo( 'name' );
		$logo_url     = Frak_Settings::get( 'logo_url' );

		$metadata = array_filter(
			array(
				'name'    => $app_name,
				'logoUrl' => '' !== $logo_url ? $logo_url : null,
			),
			static function ( $value ) {
				return null !== $value && '' !== $value;
			}
		);

		$config      = array( 'metadata' => $metadata );
		$config_json = wp_json_encode( $config, JSON_UNESCAPED_SLASHES );

		return sprintf(
			'window.FrakSetup=Object.assign(window.FrakSetup||{},{config:%s});',
			$config_json
		);
	}
}
