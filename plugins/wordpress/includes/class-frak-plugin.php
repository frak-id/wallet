<?php
/**
 * Main plugin controller.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Plugin
 */
class Frak_Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var Frak_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Get singleton instance.
	 *
	 * @return Frak_Plugin
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
		$this->includes();
		$this->init_hooks();
	}

	/**
	 * Include required files.
	 */
	private function includes() {
		require_once FRAK_PLUGIN_DIR . 'includes/class-frak-settings.php';
		require_once FRAK_PLUGIN_DIR . 'includes/class-frak-webhook-helper.php';
		require_once FRAK_PLUGIN_DIR . 'admin/class-frak-admin.php';
		require_once FRAK_PLUGIN_DIR . 'includes/class-frak-frontend.php';

		if ( class_exists( 'WooCommerce' ) ) {
			require_once FRAK_PLUGIN_DIR . 'includes/class-frak-woocommerce.php';
		}
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		register_activation_hook( FRAK_PLUGIN_FILE, array( $this, 'activate' ) );
		register_deactivation_hook( FRAK_PLUGIN_FILE, array( $this, 'deactivate' ) );

		add_action( 'init', array( $this, 'init' ) );
	}

	/**
	 * Plugin init callback.
	 */
	public function init() {
		Frak_Settings::migrate();

		if ( is_admin() ) {
			Frak_Admin::instance();

			if ( ! wp_is_block_theme() ) {
				add_action( 'admin_notices', array( $this, 'render_block_theme_notice' ) );
			}
		} elseif ( wp_is_block_theme() ) {
			Frak_Frontend::instance();
		}

		if ( class_exists( 'WooCommerce' ) && Frak_Settings::get( 'enable_purchase_tracking' ) ) {
			Frak_WooCommerce::init();
		}
	}

	/**
	 * Admin notice shown when the active theme is not a block theme.
	 */
	public function render_block_theme_notice() {
		echo '<div class="notice notice-warning"><p>';
		echo esc_html__( 'Frak requires a block theme to inject the SDK on the frontend. The settings page is still available, but the Frak SDK will not load on your site until you activate a block theme.', 'frak' );
		echo '</p></div>';
	}

	/**
	 * Plugin activation.
	 */
	public function activate() {
		flush_rewrite_rules();
	}

	/**
	 * Plugin deactivation.
	 */
	public function deactivate() {
		// Cleanup if needed.
	}
}
