<?php
/**
 * Admin settings.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Admin
 */
class Frak_Admin {

	/**
	 * Singleton instance.
	 *
	 * @var Frak_Admin|null
	 */
	private static $instance = null;

	/**
	 * Get singleton instance.
	 *
	 * @return Frak_Admin
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
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );

		// AJAX handlers for webhook operations.
		add_action( 'wp_ajax_frak_generate_webhook_secret', array( $this, 'ajax_generate_webhook_secret' ) );
		add_action( 'wp_ajax_frak_test_webhook', array( $this, 'ajax_test_webhook' ) );
		add_action( 'wp_ajax_frak_clear_webhook_logs', array( $this, 'ajax_clear_webhook_logs' ) );
		add_action( 'wp_ajax_frak_check_webhook_status', array( $this, 'ajax_check_webhook_status' ) );
	}

	/**
	 * Add admin menu page.
	 */
	public function add_admin_menu() {
		add_options_page(
			'Frak Settings',
			'Frak',
			'manage_options',
			'frak-settings',
			array( $this, 'settings_page' )
		);
	}

	/**
	 * Register plugin settings.
	 */
	public function register_settings() {
		register_setting( 'frak_settings', Frak_Settings::OPTION_KEY );
		register_setting( 'frak_settings', 'frak_webhook_secret' );
	}

	/**
	 * Enqueue admin scripts and styles.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_scripts( $hook ) {
		if ( 'settings_page_frak-settings' !== $hook ) {
			return;
		}

		$plugin_data = get_file_data( FRAK_PLUGIN_FILE, array( 'Version' => 'Version' ) );
		$version     = ! empty( $plugin_data['Version'] ) ? $plugin_data['Version'] : false;

		wp_enqueue_code_editor( array( 'type' => 'text/javascript' ) );
		wp_enqueue_script(
			'frak-admin',
			plugin_dir_url( __DIR__ ) . 'admin/js/admin.js',
			array(),
			$version,
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_enqueue_style( 'frak-admin', plugin_dir_url( __DIR__ ) . 'admin/css/admin.css', array(), $version );

		$logo_url     = '';
		$site_icon_id = get_option( 'site_icon' );
		if ( $site_icon_id ) {
			$logo_url = wp_get_attachment_image_url( $site_icon_id, 'full' );
		}
		if ( ! $logo_url ) {
			$custom_logo_id = get_theme_mod( 'custom_logo' );
			if ( $custom_logo_id ) {
				$logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
			}
		}

		wp_localize_script(
			'frak-admin',
			'frak_ajax',
			array(
				'ajax_url'  => admin_url( 'admin-ajax.php' ),
				'nonce'     => wp_create_nonce( 'frak_ajax_nonce' ),
				'site_info' => array(
					'name'     => get_bloginfo( 'name' ),
					'logo_url' => $logo_url,
				),
			)
		);
	}

	/**
	 * Render settings page.
	 */
	public function settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( isset( $_POST['submit'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce is verified by settings API.
			$this->save_settings();
		}

		$this->render_settings_page();
	}

	/**
	 * Save settings from POST data.
	 */
	private function save_settings() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- nonce is verified by settings API.
		$logo_url = isset( $_POST['frak_logo_url'] ) ? esc_url_raw( wp_unslash( $_POST['frak_logo_url'] ) ) : '';
		if ( isset( $_FILES['frak_logo_file']['error'] ) && UPLOAD_ERR_OK === $_FILES['frak_logo_file']['error'] ) {
			$uploaded_logo = $this->handle_logo_upload( $_FILES['frak_logo_file'] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- handled by wp_handle_upload.
			if ( $uploaded_logo ) {
				$logo_url = $uploaded_logo;
			}
		}

		$modal_i18n = isset( $_POST['frak_modal_i18n'] ) ? wp_unslash( $_POST['frak_modal_i18n'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized below.
		if ( is_array( $modal_i18n ) ) {
			$textarea_keys = array( 'sharing.text', 'sdk.wallet.login.text_sharing', 'sdk.wallet.login.text_referred' );
			foreach ( $modal_i18n as $key => $value ) {
				$modal_i18n[ $key ] = in_array( $key, $textarea_keys, true )
					? sanitize_textarea_field( $value )
					: sanitize_text_field( $value );
			}

			$modal_i18n = array_filter(
				$modal_i18n,
				function ( $value ) {
					return '' !== $value;
				}
			);

			if ( isset( $modal_i18n['sdk.wallet.login.text_referred'] ) ) {
				$modal_i18n['sdk.wallet.login.text'] = $modal_i18n['sdk.wallet.login.text_referred'];
			}
		}

		Frak_Settings::replace(
			array(
				'app_name'                 => isset( $_POST['frak_app_name'] ) ? sanitize_text_field( wp_unslash( $_POST['frak_app_name'] ) ) : '',
				'logo_url'                 => $logo_url,
				'enable_purchase_tracking' => isset( $_POST['frak_enable_purchase_tracking'] ) ? 1 : 0,
				'enable_floating_button'   => isset( $_POST['frak_enable_floating_button'] ) ? 1 : 0,
				'show_reward'              => isset( $_POST['frak_show_reward'] ) ? 1 : 0,
				'button_classname'         => isset( $_POST['frak_button_classname'] ) ? sanitize_text_field( wp_unslash( $_POST['frak_button_classname'] ) ) : '',
				'floating_button_position' => isset( $_POST['frak_floating_button_position'] ) ? sanitize_text_field( wp_unslash( $_POST['frak_floating_button_position'] ) ) : 'right',
				'modal_language'           => isset( $_POST['frak_modal_language'] ) ? sanitize_text_field( wp_unslash( $_POST['frak_modal_language'] ) ) : 'default',
				'modal_i18n'               => wp_json_encode( $modal_i18n ),
			)
		);
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$this->clear_caches();
	}

	/**
	 * Clear caches from popular caching plugins.
	 */
	private function clear_caches() {
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}
		wp_cache_flush();
	}

	/**
	 * Render the settings page template.
	 */
	private function render_settings_page() {
		$default_app_name = get_bloginfo( 'name' );
		$default_logo_url = $this->get_site_icon_url();

		$stored_app_name          = Frak_Settings::get( 'app_name' );
		$stored_logo_url          = Frak_Settings::get( 'logo_url' );
		$app_name                 = '' !== $stored_app_name ? $stored_app_name : $default_app_name;
		$logo_url                 = '' !== $stored_logo_url ? $stored_logo_url : $default_logo_url;
		$enable_tracking          = Frak_Settings::get( 'enable_purchase_tracking' );
		$enable_button            = Frak_Settings::get( 'enable_floating_button' );
		$show_reward              = Frak_Settings::get( 'show_reward' );
		$button_classname         = Frak_Settings::get( 'button_classname' );
		$floating_button_position = Frak_Settings::get( 'floating_button_position' );
		$modal_language           = Frak_Settings::get( 'modal_language' );
		$modal_i18n               = json_decode( Frak_Settings::get( 'modal_i18n' ), true );

		include FRAK_PLUGIN_DIR . 'admin/views/settings-page.php';
	}

	/**
	 * Get the site icon URL.
	 *
	 * @return string
	 */
	private function get_site_icon_url() {
		$site_icon_id = get_option( 'site_icon' );
		if ( $site_icon_id ) {
			$site_icon_url = wp_get_attachment_image_url( $site_icon_id, 'full' );
			if ( $site_icon_url ) {
				return $site_icon_url;
			}
		}

		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$custom_logo_url = wp_get_attachment_image_url( $custom_logo_id, 'full' );
			if ( $custom_logo_url ) {
				return $custom_logo_url;
			}
		}

		return '';
	}

	/**
	 * Handle logo file upload.
	 *
	 * @param array $file Uploaded file data.
	 * @return string|false URL on success, false on failure.
	 */
	private function handle_logo_upload( $file ) {
		$allowed_types = array( 'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml' );
		if ( ! in_array( $file['type'], $allowed_types, true ) ) {
			return false;
		}

		if ( $file['size'] > 2 * 1024 * 1024 ) {
			return false;
		}

		if ( ! function_exists( 'wp_handle_upload' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$upload_overrides = array( 'test_form' => false );
		$movefile         = wp_handle_upload( $file, $upload_overrides );

		if ( $movefile && ! isset( $movefile['error'] ) ) {
			return $movefile['url'];
		}

		return false;
	}

	/**
	 * AJAX: Generate webhook secret.
	 */
	public function ajax_generate_webhook_secret() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$secret = wp_generate_password( 32, false );
		update_option( 'frak_webhook_secret', $secret );

		wp_send_json_success(
			array(
				'secret'  => $secret,
				'message' => __( 'Webhook secret generated successfully', 'frak' ),
			)
		);
	}

	/**
	 * AJAX: Test webhook.
	 */
	public function ajax_test_webhook() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$result = Frak_Webhook_Helper::test_webhook();

		if ( $result['success'] ) {
			wp_send_json_success(
				array(
					/* translators: %d: execution time in milliseconds */
					'message' => sprintf( __( 'Webhook test successful (%dms)', 'frak' ), $result['execution_time'] ),
					'details' => $result,
				)
			);
		} else {
			wp_send_json_error(
				array(
					'message' => __( 'Webhook test failed: ', 'frak' ) . $result['error'],
					'details' => $result,
				)
			);
		}
	}

	/**
	 * AJAX: Clear webhook logs.
	 */
	public function ajax_clear_webhook_logs() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		Frak_Webhook_Helper::clear_webhook_logs();

		wp_send_json_success(
			array(
				'message' => __( 'Webhook logs cleared successfully', 'frak' ),
			)
		);
	}

	/**
	 * AJAX: Check webhook status.
	 */
	public function ajax_check_webhook_status() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$status = Frak_Webhook_Helper::get_webhook_status();

		wp_send_json_success(
			array(
				'status' => $status,
			)
		);
	}
}
