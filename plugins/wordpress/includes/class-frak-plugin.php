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
		$this->define_constants();
		$this->includes();
		$this->init_hooks();
	}

	/**
	 * Define plugin constants.
	 */
	private function define_constants() {
		define( 'FRAK_PLUGIN_DIR', plugin_dir_path( __DIR__ ) );
		define( 'FRAK_PLUGIN_URL', plugin_dir_url( __DIR__ ) );
		define( 'FRAK_PLUGIN_FILE', dirname( __DIR__ ) . '/frak-integration.php' );
	}

	/**
	 * Include required files.
	 */
	private function includes() {
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
		if ( is_admin() ) {
			Frak_Admin::instance();
		} else {
			Frak_Frontend::instance();
		}

		if ( class_exists( 'WooCommerce' ) && get_option( 'frak_enable_purchase_tracking', 0 ) ) {
			Frak_WooCommerce::instance();
		}
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
