<?php
/**
 * WooCommerce webhook registrar.
 *
 * Owns the lifecycle of the WooCommerce `WC_Webhook` row that ships order
 * updates to the Frak backend. Previously the plugin hand-rolled the HTTP
 * call (HMAC signing, Action Scheduler dispatch, log ring buffer); now it
 * delegates everything to WooCommerce's native webhook system, which already
 * handles signing (base64 HMAC-SHA256 → `X-WC-Webhook-Signature`), retries
 * (5 attempts before auto-disable), and delivery logging (visible under
 * `WooCommerce → Status → Logs` with source `webhooks-delivery`).
 *
 * The backend `/ext/merchant/:id/webhook/woocommerce` endpoint accepts WC's
 * native payload shape and HMAC header, so no custom PHP dispatcher is
 * needed — the plugin's job collapses to "ensure the right webhook exists,
 * with the right URL, with the right secret".
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_WC_Webhook_Registrar
 */
class Frak_WC_Webhook_Registrar {

	/**
	 * Topic the webhook listens on. `order.updated` fires on every `wp_update_post`
	 * save for the `shop_order` CPT (and the HPOS equivalent), which matches the
	 * legacy `woocommerce_order_status_changed` trigger the plugin previously
	 * used — status transitions, refunds, and cancellations all save the order.
	 */
	public const TOPIC = 'order.updated';

	/**
	 * API version passed to `WC_Webhook::set_api_version()`. WC's API v3 is what
	 * the Frak backend DTO (`WooCommerceOrderUpdateWebhookDto`) mirrors.
	 */
	public const API_VERSION = 'wp_api_v3';

	/**
	 * Option row storing the WC webhook id we own so we don't spawn duplicates.
	 * autoload=no — only read on admin + activation paths.
	 */
	public const OPTION_ID = 'frak_wc_webhook_id';

	/**
	 * Human-readable name for the webhook in WC's admin UI. Merchants can see
	 * (and disable) this webhook under `WooCommerce → Settings → Advanced → Webhooks`.
	 */
	public const WEBHOOK_NAME = 'Frak attribution';

	/**
	 * Register hooks. Called once from {@see Frak_Plugin::init()}.
	 *
	 * Keeping these option-update hooks here instead of on a class-load action
	 * means we only pay for a sync when a Frak-owned option actually changes.
	 */
	public static function init() {
		add_action( 'update_option_frak_webhook_secret', array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'add_option_frak_webhook_secret', array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'update_option_' . Frak_Merchant::OPTION_KEY, array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'add_option_' . Frak_Merchant::OPTION_KEY, array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
	}

	/**
	 * Handler for option updates — bridges to {@see self::ensure()} with no
	 * args so the caller signatures stay compatible with WP's `update_option_*`
	 * / `add_option_*` hooks (which pass different arg counts).
	 */
	public static function sync_on_option_change() {
		self::ensure();
	}

	/**
	 * Create or update the Frak-owned WC webhook so it points at the right URL
	 * with the current secret. Idempotent — safe to call on every settings save
	 * and on plugin activation.
	 *
	 * Silently no-ops when:
	 *   - WooCommerce is not active (nothing to wire up).
	 *   - The merchant hasn't been resolved yet (webhook URL would be invalid).
	 *   - No webhook secret has been configured (delivery would fail HMAC).
	 *
	 * @return int|null Webhook id on success, null when prerequisites are missing.
	 */
	public static function ensure() {
		if ( ! self::is_wc_available() ) {
			return null;
		}

		$merchant_id = Frak_Merchant::get_id();
		$secret      = (string) get_option( 'frak_webhook_secret', '' );
		if ( ! $merchant_id || '' === $secret ) {
			return null;
		}

		$delivery_url = self::build_delivery_url( $merchant_id );
		$webhook      = self::load_or_new_webhook();

		$owner_id = get_current_user_id();
		if ( ! $owner_id ) {
			$owner_id = self::pick_owner_user_id();
		}
		$webhook->set_user_id( $owner_id );
		$webhook->set_name( self::WEBHOOK_NAME );
		$webhook->set_topic( self::TOPIC );
		$webhook->set_delivery_url( $delivery_url );
		$webhook->set_secret( $secret );
		$webhook->set_api_version( self::API_VERSION );
		$webhook->set_status( 'active' );

		$webhook_id = $webhook->save();

		if ( $webhook_id ) {
			update_option( self::OPTION_ID, (int) $webhook_id, false );
		}

		return $webhook_id ? (int) $webhook_id : null;
	}

	/**
	 * Return the current health of the Frak-owned webhook, suitable for
	 * rendering a warning banner on the settings page.
	 *
	 * @return array{
	 *     exists: bool,
	 *     status: string,
	 *     expected_url: string,
	 *     delivery_url: string,
	 *     url_matches: bool,
	 *     secret_configured: bool,
	 *     merchant_resolved: bool,
	 *     wc_available: bool,
	 * }
	 */
	public static function status() {
		$merchant_id       = Frak_Merchant::get_id();
		$secret_configured = '' !== (string) get_option( 'frak_webhook_secret', '' );
		$wc_available      = self::is_wc_available();

		$expected_url = $merchant_id ? self::build_delivery_url( $merchant_id ) : '';

		$webhook = $wc_available ? self::load_existing_webhook() : null;

		return array(
			'exists'            => null !== $webhook,
			'status'            => $webhook ? $webhook->get_status() : '',
			'expected_url'      => $expected_url,
			'delivery_url'      => $webhook ? $webhook->get_delivery_url() : '',
			'url_matches'       => $webhook ? $webhook->get_delivery_url() === $expected_url : false,
			'secret_configured' => $secret_configured,
			'merchant_resolved' => null !== $merchant_id,
			'wc_available'      => $wc_available,
		);
	}

	/**
	 * Remove the Frak-owned webhook. Called on plugin deactivation.
	 */
	public static function remove() {
		if ( ! self::is_wc_available() ) {
			return;
		}

		$webhook = self::load_existing_webhook();
		if ( $webhook ) {
			$webhook->delete( true );
		}
		delete_option( self::OPTION_ID );
	}

	/**
	 * Whether WooCommerce is available in the current request.
	 */
	private static function is_wc_available(): bool {
		return class_exists( 'WooCommerce' ) && class_exists( 'WC_Webhook' ) && function_exists( 'wc_get_webhook' );
	}

	/**
	 * Construct the backend delivery URL for a given merchant.
	 *
	 * @param string $merchant_id UUID of the Frak merchant.
	 */
	private static function build_delivery_url( string $merchant_id ): string {
		return 'https://backend.frak.id/ext/merchant/' . rawurlencode( $merchant_id ) . '/webhook/woocommerce';
	}

	/**
	 * Load the existing Frak webhook by stored id, or null when it was deleted
	 * from under us via the WC admin UI (we lazily recreate on {@see ensure()}).
	 */
	private static function load_existing_webhook(): ?WC_Webhook {
		$stored_id = (int) get_option( self::OPTION_ID, 0 );
		if ( ! $stored_id ) {
			return null;
		}
		$webhook = wc_get_webhook( $stored_id );
		return $webhook instanceof WC_Webhook ? $webhook : null;
	}

	/**
	 * Load the existing Frak webhook or instantiate a fresh `WC_Webhook` we
	 * are going to populate + save.
	 */
	private static function load_or_new_webhook(): WC_Webhook {
		return self::load_existing_webhook() ?? new WC_Webhook();
	}

	/**
	 * Fallback owner when `get_current_user_id()` returns 0 (activation from
	 * CLI, cron context). Use the first user with `manage_woocommerce` so the
	 * webhook shows up under a sensible account in the WC admin UI.
	 */
	private static function pick_owner_user_id(): int {
		$users = get_users(
			array(
				'capability' => 'manage_woocommerce',
				'number'     => 1,
				'fields'     => 'ID',
			)
		);
		return isset( $users[0] ) ? (int) $users[0] : 0;
	}
}
