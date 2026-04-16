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
		$this->init_hooks();
	}


	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		register_deactivation_hook( FRAK_PLUGIN_FILE, array( $this, 'deactivate' ) );

		add_action( 'init', array( $this, 'init' ) );
	}

	/**
	 * Plugin init callback.
	 */
	public function init() {
		// Skip entirely in WP-CLI context — frontend SDK injection and admin UI
		// are irrelevant when the request is a command-line invocation.
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			return;
		}

		// In cron, only the WooCommerce async-dispatch handlers need to be
		// registered (that's where `frak_dispatch_webhook` runs). Everything
		// else — admin UI, frontend enqueues, block registration — would be
		// dead weight.
		if ( wp_doing_cron() ) {
			if ( class_exists( 'WooCommerce' ) ) {
				Frak_WooCommerce::init();
			}
			return;
		}

		if ( is_admin() ) {
			Frak_Admin::instance();

			if ( ! wp_is_block_theme() ) {
				add_action( 'admin_notices', array( $this, 'render_block_theme_notice' ) );
			}
		} elseif ( wp_is_block_theme() ) {
			Frak_Frontend::instance();
		}

		Frak_Blocks::init();

		if ( class_exists( 'WooCommerce' ) ) {
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
	 * Plugin activation — delegated to the activation hook in the main
	 * plugin file. Kept for backwards compatibility with the deactivation
	 * counterpart below; safe to remove once no external code calls it.
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
