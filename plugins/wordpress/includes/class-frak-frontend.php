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
		$has_config = ! empty( get_option( 'frak_app_name', '' ) );

		if ( $has_config ) {
			wp_enqueue_script(
				'frak-sdk',
				'https://cdn.jsdelivr.net/npm/@frak-labs/components',
				array(),
				false,
				true
			);

			wp_script_add_data( 'frak-sdk', 'defer', true );

			$inline_script = $this->generate_config_script();
			wp_add_inline_script( 'frak-sdk', $inline_script, 'after' );
		}
	}

	/**
	 * Add floating button to footer.
	 */
	public function add_floating_button() {
		if ( ! get_option( 'frak_enable_floating_button', 0 ) ) {
			return;
		}

		$show_reward = get_option( 'frak_show_reward', 0 );
		$classname   = get_option( 'frak_button_classname', '' );

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
	 * Generate the configuration script.
	 *
	 * @return string
	 */
	private function generate_config_script() {
		$app_name                 = esc_js( get_option( 'frak_app_name', get_bloginfo( 'name' ) ) );
		$logo_url                 = esc_js( get_option( 'frak_logo_url', '' ) );
		$modal_language           = get_option( 'frak_modal_language', 'default' );
		$floating_button_position = esc_js( get_option( 'frak_floating_button_position', 'right' ) );
		$modal_i18n               = get_option( 'frak_modal_i18n', '{}' );

		$shop_name    = esc_js( get_bloginfo( 'name' ) );
		$modal_lng    = 'default' === $modal_language ? 'default' : esc_js( $modal_language );
		$decoded_i18n = json_decode( $modal_i18n, true );

		$config = array(
			'walletUrl'      => 'https://wallet.frak.id',
			'metadata'       => array(
				'name'    => $shop_name,
				'lang'    => 'default' === $modal_lng ? null : $modal_lng,
				'logoUrl' => $logo_url,
			),
			'customizations' => array(
				'i18n' => empty( $decoded_i18n ) ? new stdClass() : $decoded_i18n,
			),
			'domain'         => 'window.location.host',
		);

		$modal_config = array(
			'login' => array(
				'allowSso'    => true,
				'ssoMetadata' => array(
					'logoUrl'      => $logo_url,
					'homepageLink' => 'window.location.host',
				),
			),
		);

		$modal_share_config = array(
			'link' => 'window.location.href',
		);

		$modal_wallet_config = array(
			'metadata' => array(
				'position' => $floating_button_position,
			),
		);

		$config_json              = wp_json_encode( $config, JSON_UNESCAPED_SLASHES );
		$modal_config_json        = wp_json_encode( $modal_config, JSON_UNESCAPED_SLASHES );
		$modal_share_config_json  = wp_json_encode( $modal_share_config, JSON_UNESCAPED_SLASHES );
		$modal_wallet_config_json = wp_json_encode( $modal_wallet_config, JSON_UNESCAPED_SLASHES );

		// Replace quoted dynamic values with actual JavaScript expressions.
		$config_json             = str_replace( '"window.location.host"', 'window.location.host', $config_json );
		$modal_config_json       = str_replace( '"window.location.host"', 'window.location.host', $modal_config_json );
		$modal_share_config_json = str_replace( '"window.location.href"', 'window.location.href', $modal_share_config_json );

		// Remove null values from the JSON.
		$config_json = preg_replace( '/,?"lang":null/', '', $config_json );

		$script = "
window.FrakSetup = {
    config: {$config_json},
    modalConfig: {$modal_config_json},
    modalShareConfig: {$modal_share_config_json},
    modalWalletConfig: {$modal_wallet_config_json}
};";

		return $script;
	}
}
