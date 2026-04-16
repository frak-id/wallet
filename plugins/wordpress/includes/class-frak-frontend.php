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
		add_action( 'wp_footer', array( $this, 'add_floating_button' ) );
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
	 * Add floating button to footer.
	 */
	public function add_floating_button() {
		if ( ! Frak_Settings::get( 'enable_floating_button' ) ) {
			return;
		}

		$show_reward = Frak_Settings::get( 'show_reward' );
		$classname   = Frak_Settings::get( 'button_classname' );

		$attributes = array();
		if ( $show_reward ) {
			$attributes[] = 'use-reward';
		}
		if ( ! empty( $classname ) ) {
			$attributes[] = 'classname="' . esc_attr( $classname ) . '"';
		}

		echo '<frak-button-wallet ' . implode( ' ', $attributes ) . '></frak-button-wallet>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- attributes are escaped above.
	}

	/**
	 * Generate the inline configuration script for window.FrakSetup.
	 *
	 * Shape matches the current SDK contract (see @frak-labs/components):
	 *   window.FrakSetup = {
	 *     config: FrakWalletSdkConfig,
	 *     modalWalletConfig: DisplayEmbeddedWalletParamsType,
	 *   };
	 *
	 * Only fields the user can configure are emitted. Defaults such as
	 * `walletUrl` and `domain` are left to the SDK.
	 *
	 * @return string
	 */
	private function generate_config_script() {
		$app_name_raw    = Frak_Settings::get( 'app_name' );
		$app_name        = '' !== $app_name_raw ? $app_name_raw : get_bloginfo( 'name' );
		$logo_url        = Frak_Settings::get( 'logo_url' );
		$modal_language  = Frak_Settings::get( 'modal_language' );
		$button_position = Frak_Settings::get( 'floating_button_position' );
		$modal_i18n_raw  = Frak_Settings::get( 'modal_i18n' );

		$metadata = array_filter(
			array(
				'name'    => $app_name,
				'lang'    => 'default' === $modal_language ? null : $modal_language,
				'logoUrl' => '' !== $logo_url ? $logo_url : null,
			),
			function ( $value ) {
				return null !== $value && '' !== $value;
			}
		);

		$decoded_i18n   = json_decode( $modal_i18n_raw, true );
		$customizations = array();
		if ( is_array( $decoded_i18n ) && ! empty( $decoded_i18n ) ) {
			$customizations['i18n'] = $decoded_i18n;
		}

		$config = array( 'metadata' => $metadata );
		if ( ! empty( $customizations ) ) {
			$config['customizations'] = $customizations;
		}

		$modal_wallet_config = array(
			'metadata' => array(
				'position' => in_array( $button_position, array( 'left', 'right' ), true ) ? $button_position : 'right',
			),
		);

		$config_json              = wp_json_encode( $config, JSON_UNESCAPED_SLASHES );
		$modal_wallet_config_json = wp_json_encode( $modal_wallet_config, JSON_UNESCAPED_SLASHES );

		return sprintf(
			'window.FrakSetup=Object.assign(window.FrakSetup||{},{config:%s,modalWalletConfig:%s});',
			$config_json,
			$modal_wallet_config_json
		);
	}
}
