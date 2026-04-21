<?php
/**
 * Admin settings.
 *
 * Stateless static class — mirrors the pattern used by {@see Frak_WooCommerce}
 * and {@see Frak_WC_Webhook_Registrar}. {@see init()} registers the hooks on
 * `Frak_Plugin::init()`; every callback is static so no instance is held
 * between requests.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Admin
 */
class Frak_Admin {

	/**
	 * Nonce action for the settings form submission.
	 *
	 * The form posts back to the same page (instead of `options.php`) because
	 * the settings payload is multipart (logo file upload), which does not map
	 * cleanly onto the Settings API's `register_setting` sanitize-callback
	 * pipeline. We therefore replicate the two security guarantees the Settings
	 * API would provide:
	 *   - `wp_nonce_field( SETTINGS_NONCE_ACTION )` emitted in the template.
	 *   - `check_admin_referer()` + capability check in {@see save_settings()}.
	 */
	public const SETTINGS_NONCE_ACTION = 'frak_save_settings';

	/**
	 * Register admin hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_scripts' ) );

		// AJAX handlers for webhook operations.
		add_action( 'wp_ajax_frak_refresh_merchant', array( __CLASS__, 'ajax_refresh_merchant' ) );
		add_action( 'wp_ajax_frak_setup_wc_webhook', array( __CLASS__, 'ajax_setup_wc_webhook' ) );
	}

	/**
	 * Add admin menu page.
	 */
	public static function add_admin_menu() {
		add_options_page(
			'Frak Settings',
			'Frak',
			'manage_options',
			'frak-settings',
			array( __CLASS__, 'settings_page' )
		);
	}

	/**
	 * Enqueue admin scripts and styles.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue_scripts( $hook ) {
		if ( 'settings_page_frak-settings' !== $hook ) {
			return;
		}

		$version = defined( 'FRAK_PLUGIN_VERSION' ) ? FRAK_PLUGIN_VERSION : false;

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

		// Emit the AJAX bootstrap payload as a plain JSON object on
		// `window.frak_ajax` — `wp_localize_script` used to do this, but it
		// forces the value through `esc_attr`-style mangling and is slated
		// for eventual deprecation. `wp_add_inline_script` with `'before'`
		// runs prior to the deferred admin script executing.
		$ajax_payload = array(
			'ajax_url'  => admin_url( 'admin-ajax.php' ),
			'nonce'     => wp_create_nonce( 'frak_ajax_nonce' ),
			'site_info' => array(
				'name'     => get_bloginfo( 'name' ),
				'logo_url' => Frak_Utils::site_icon_url(),
			),
		);
		wp_add_inline_script(
			'frak-admin',
			'var frak_ajax = ' . wp_json_encode( $ajax_payload ) . ';',
			'before'
		);
	}

	/**
	 * Render settings page.
	 */
	public static function settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( isset( $_POST['submit'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- the nonce is verified inside save_settings() via check_admin_referer().
			self::save_settings();
		}

		self::render_settings_page();
	}

	/**
	 * Save settings from POST data.
	 *
	 * CSRF + capability protection: the template emits `wp_nonce_field()` with
	 * {@see self::SETTINGS_NONCE_ACTION}, and `check_admin_referer()` below both
	 * verifies the nonce and bails (via `wp_die`) when it is missing/invalid.
	 * A redundant capability re-check guards against a hook that lowered the
	 * requirement between page render and submit.
	 */
	private static function save_settings() {
		check_admin_referer( self::SETTINGS_NONCE_ACTION );

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$logo_url = isset( $_POST['frak_logo_url'] ) ? esc_url_raw( wp_unslash( $_POST['frak_logo_url'] ) ) : '';
		if ( isset( $_FILES['frak_logo_file']['error'] ) && UPLOAD_ERR_OK === $_FILES['frak_logo_file']['error'] ) {
			$uploaded_logo = self::handle_logo_upload( $_FILES['frak_logo_file'] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- handled by wp_handle_upload.
			if ( $uploaded_logo ) {
				$logo_url = $uploaded_logo;
			}
		}

		Frak_Settings::replace(
			array(
				'app_name' => isset( $_POST['frak_app_name'] ) ? sanitize_text_field( wp_unslash( $_POST['frak_app_name'] ) ) : '',
				'logo_url' => $logo_url,
			)
		);

		// The webhook secret is owned by the Frak business dashboard (single source
		// of truth stored backend-side on `merchantWebhooksTable.hookSignatureKey`).
		// The admin pastes it here so outbound HMAC signatures match what the
		// backend verifies. An empty submission clears the row and disables dispatch.
		// Stored with `autoload=no` so the credential is not loaded on every
		// request (only webhook send / admin pages read it).
		if ( isset( $_POST['frak_webhook_secret'] ) ) {
			$submitted_secret = sanitize_text_field( wp_unslash( $_POST['frak_webhook_secret'] ) );
			update_option( 'frak_webhook_secret', $submitted_secret, false );
		}

		self::clear_caches();
	}

	/**
	 * Clear front-end page caches from popular caching plugins.
	 *
	 * Scoped to page-cache plugins on purpose — we deliberately avoid
	 * `wp_cache_flush()` because on sites running a persistent object cache
	 * (Redis, Memcached) that would nuke the entire site's cache
	 * (posts, terms, user sessions) on every settings save. The plugin only
	 * needs the rendered HTML to be regenerated so the new `window.FrakSetup`
	 * config is emitted on the next request; the underlying settings are
	 * hydrated fresh on the next request anyway (single autoloaded row, no
	 * object-cache layer in between).
	 *
	 * Covers the five most common page-cache plugins on WP.org: WP Rocket,
	 * W3 Total Cache, WP Super Cache, LiteSpeed Cache, and Hummingbird. Each
	 * one exposes either a direct helper function or a well-known action
	 * hook for third-party integrations to trigger a flush.
	 */
	private static function clear_caches() {
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}
		// LiteSpeed Cache exposes a standard action hook for third-party purge.
		if ( defined( 'LSCWP_V' ) || has_action( 'litespeed_purge_all' ) ) {
			do_action( 'litespeed_purge_all' );
		}
		// Hummingbird fires this action to clear its page cache.
		if ( has_action( 'wphb_clear_page_cache' ) ) {
			do_action( 'wphb_clear_page_cache' );
		}
	}

	/**
	 * Render the settings page template.
	 */
	private static function render_settings_page() {
		$default_app_name = get_bloginfo( 'name' );
		$default_logo_url = Frak_Utils::site_icon_url();

		$stored_app_name = Frak_Settings::get( 'app_name' );
		$stored_logo_url = Frak_Settings::get( 'logo_url' );
		$app_name        = '' !== $stored_app_name ? $stored_app_name : $default_app_name;
		$logo_url        = '' !== $stored_logo_url ? $stored_logo_url : $default_logo_url;

		include FRAK_PLUGIN_DIR . 'admin/views/settings-page.php';
	}

	/**
	 * Handle logo file upload.
	 *
	 * Uses `wp_check_filetype_and_ext()` to validate the real MIME type
	 * against the uploaded extension — this catches `evil.php` renamed to
	 * `evil.jpg` with a spoofed `image/jpeg` header, which the previous
	 * browser-supplied `$file['type']` check could not. `wp_handle_upload`
	 * itself re-runs the same check, but validating up-front lets us reject
	 * the upload before the tmp file is moved into `wp-content/uploads/`.
	 *
	 * @param array<string, mixed> $file Uploaded file data.
	 * @return string|false URL on success, false on failure.
	 */
	private static function handle_logo_upload( $file ) {
		// Reject oversized uploads before touching the filesystem.
		if ( ! isset( $file['size'] ) || $file['size'] > 2 * 1024 * 1024 ) {
			return false;
		}

		if ( ! function_exists( 'wp_check_filetype_and_ext' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$allowed_mimes = array(
			'jpg|jpeg|jpe' => 'image/jpeg',
			'png'          => 'image/png',
			'gif'          => 'image/gif',
		);

		$check = wp_check_filetype_and_ext(
			isset( $file['tmp_name'] ) ? $file['tmp_name'] : '',
			isset( $file['name'] ) ? $file['name'] : '',
			$allowed_mimes
		);

		if ( empty( $check['type'] ) || ! in_array( $check['type'], $allowed_mimes, true ) ) {
			return false;
		}

		$upload_overrides = array(
			'test_form' => false,
			'mimes'     => $allowed_mimes,
		);
		$movefile         = wp_handle_upload( $file, $upload_overrides );

		if ( $movefile && ! isset( $movefile['error'] ) ) {
			return $movefile['url'];
		}

		return false;
	}

	/**
	 * AJAX: Refresh the cached merchant record for the current site.
	 *
	 * Invalidates the `frak_merchant` option + negative cache, re-queries
	 * the backend's resolve endpoint, and returns the fresh record. Wired
	 * to the "Refresh Merchant" button on the admin settings page so
	 * operators can recover from a delete-and-recreate, a domain change,
	 * or the 5-minute negative-cache window without waiting for a webhook.
	 */
	public static function ajax_refresh_merchant() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		Frak_Merchant::invalidate();
		$record = Frak_Merchant::get_record();

		if ( null === $record ) {
			wp_send_json_error(
				array(
					'message' => __( 'Merchant not found for this domain. Register it on business.frak.id first.', 'frak' ),
				)
			);
		}

		wp_send_json_success(
			array(
				'message' => __( 'Merchant refreshed', 'frak' ),
				'record'  => $record,
			)
		);
	}

	/**
	 * AJAX: Create / refresh the WooCommerce webhook that ships order events
	 * to the Frak backend. Wired to the "Set up" / "Re-enable" button on the
	 * settings page so operators can recover from a manually-disabled webhook
	 * (or a fresh install) without editing WC's advanced settings directly.
	 */
	public static function ajax_setup_wc_webhook() {
		check_ajax_referer( 'frak_ajax_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		if ( ! class_exists( 'Frak_WC_Webhook_Registrar' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'WooCommerce integration unavailable.', 'frak' ),
				)
			);
		}

		$webhook_id = Frak_WC_Webhook_Registrar::ensure();
		$status     = Frak_WC_Webhook_Registrar::status();

		if ( null === $webhook_id ) {
			if ( ! $status['wc_available'] ) {
				$message = __( 'WooCommerce is not active on this site.', 'frak' );
			} elseif ( ! $status['merchant_resolved'] ) {
				$message = __( 'Merchant not resolved for this domain — register it in your Frak business dashboard (Merchant → Allowed Domains).', 'frak' );
			} elseif ( ! $status['domain_matches'] ) {
				$message = __( 'This site\'s domain changed since the merchant record was cached. Click "Refresh Merchant" first.', 'frak' );
			} elseif ( ! $status['secret_configured'] ) {
				$message = __( 'Paste the webhook secret from your Frak dashboard and save the form before enabling.', 'frak' );
			} else {
				$message = __( 'Failed to create the WooCommerce webhook — check WooCommerce → Status → Logs for details.', 'frak' );
			}

			wp_send_json_error( array( 'message' => $message ) );
		}

		wp_send_json_success(
			array(
				'message' => __( 'WooCommerce webhook is active — order updates will now reach Frak.', 'frak' ),
				'status'  => $status,
			)
		);
	}
}
