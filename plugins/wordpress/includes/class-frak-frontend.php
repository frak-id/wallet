<?php
/**
 * Frontend functionality.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Frontend
 */
class Frak_Frontend {

	/**
	 * Singleton instance.
	 *
	 * @var Frak_Frontend|null
	 */
	private static $instance = null;

	/**
	 * Get singleton instance.
	 *
	 * @return Frak_Frontend
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ), 20 );
		add_filter( 'wp_resource_hints', array( $this, 'add_resource_hints' ), 10, 2 );
	}

	/**
	 * Enqueue frontend scripts.
	 */
	public function enqueue_scripts() {
		if ( empty( Frak_Settings::get( 'app_name' ) ) ) {
			return;
		}

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
		wp_add_inline_script( 'frak-sdk', $this->generate_config_script(), 'before' );
	}

	/**
	 * Append DNS-prefetch / preconnect hints for the SDK origin so the
	 * browser can warm the TLS handshake before the `<script>` tag parses.
	 * Skipped when no app name is set (SDK is not enqueued in that case).
	 *
	 * @param array<int, string|array<string, string>> $hints    Existing hints from core.
	 * @param string                                   $relation Relation type being filtered.
	 * @return array<int, string|array<string, string>>
	 */
	public function add_resource_hints( $hints, $relation ) {
		if ( empty( Frak_Settings::get( 'app_name' ) ) ) {
			return $hints;
		}
		if ( 'dns-prefetch' === $relation || 'preconnect' === $relation ) {
			$hints[] = 'https://cdn.jsdelivr.net';
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
	private function generate_config_script() {
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
