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
	 * Transient used as a short-lived lock so two concurrent admin requests can't
	 * race through {@see self::ensure()} and spawn duplicate `WC_Webhook` rows
	 * before the `frak_wc_webhook_id` option is written.
	 */
	private const LOCK_KEY = 'frak_wc_webhook_ensure_lock';

	/**
	 * Lock TTL (seconds). Long enough to cover the WC save + `deliver_ping()`
	 * handshake, short enough not to wedge the admin if the holder dies.
	 */
	private const LOCK_TTL = 15;

	/**
	 * Register hooks. Called once from {@see Frak_Plugin::init()}.
	 *
	 * Keeping these option-update hooks here instead of on a class-load action
	 * means we only pay for a sync when a Frak-owned option actually changes.
	 *
	 * `home`/`siteurl` are also watched because the backend merchant record is
	 * keyed on `home_url()` host: when an operator points the site at a new
	 * domain we both invalidate the merchant cache (so the resolve HTTP call
	 * re-runs against the new host) and re-`ensure()` so the webhook URL
	 * updates in lock-step.
	 */
	public static function init() {
		add_action( 'update_option_frak_webhook_secret', array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'add_option_frak_webhook_secret', array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'update_option_' . Frak_Merchant::OPTION_KEY, array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'add_option_' . Frak_Merchant::OPTION_KEY, array( __CLASS__, 'sync_on_option_change' ), 10, 0 );
		add_action( 'update_option_home', array( __CLASS__, 'handle_home_url_change' ), 10, 0 );
		add_action( 'update_option_siteurl', array( __CLASS__, 'handle_home_url_change' ), 10, 0 );
	}

	/**
	 * Register the `woocommerce_webhook_payload` filter that strips outgoing
	 * order payloads down to the field-set the Frak backend actually consumes.
	 *
	 * Split from {@see init()} because webhook delivery happens in EVERY
	 * request context — the option-update hooks in `init()` only matter for
	 * admin/CLI/cron (the only contexts that mutate the watched options),
	 * but the payload filter must also run on the frontend request that
	 * triggered the order status change (WC dispatches webhooks synchronously
	 * from `woocommerce_update_order` by default).
	 *
	 * Late priority (`99`) so any other plugin filtering the payload sees the
	 * full WC-built shape; we narrow last so PII added by other filters is
	 * also dropped before HMAC signing.
	 */
	public static function init_payload_filter() {
		add_filter( 'woocommerce_webhook_payload', array( __CLASS__, 'filter_payload' ), 99, 4 );
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
	 * Handler for `home`/`siteurl` option changes. Invalidate the cached merchant
	 * record (its `domain` key no longer matches the new host) and then run
	 * ensure() — if the new host resolves to a different merchant, the webhook
	 * URL is updated; if it does not resolve yet, ensure() silently no-ops and
	 * the admin banner surfaces the "register this domain" hint on the next
	 * settings-page load.
	 */
	public static function handle_home_url_change() {
		if ( class_exists( 'Frak_Merchant' ) ) {
			Frak_Merchant::invalidate();
		}
		self::ensure();
	}

	/**
	 * Create or update the Frak-owned WC webhook so it points at the right URL
	 * with the current secret. Idempotent — safe to call on every settings save
	 * and on plugin activation.
	 *
	 * Idempotency guarantees:
	 *   - A transient lock prevents two concurrent requests from saving two
	 *     `WC_Webhook` rows before the `frak_wc_webhook_id` option is updated.
	 *   - If the stored id references a deleted/missing webhook, we search WC's
	 *     webhook table by `WEBHOOK_NAME` + `TOPIC` first and adopt that row
	 *     instead of creating a duplicate (covers operators who manually
	 *     deleted the option row but not the webhook, or vice versa).
	 *
	 * Silently no-ops when:
	 *   - WooCommerce is not active (nothing to wire up).
	 *   - The merchant hasn't been resolved yet (webhook URL would be invalid).
	 *   - No webhook secret has been configured (delivery would fail HMAC).
	 *
	 * @return int|null Webhook id on success, null when prerequisites are missing
	 *                  or the underlying `WC_Webhook::save()` failed.
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

		// If another request is mid-ensure, return best-effort: the webhook id
		// we already have on file. The concurrent request will finish the real
		// work; we avoid racing on `WC_Webhook::save()`.
		if ( get_transient( self::LOCK_KEY ) ) {
			$existing = self::load_existing_webhook() ?? self::find_orphaned_webhook();
			return $existing ? (int) $existing->get_id() : null;
		}

		set_transient( self::LOCK_KEY, 1, self::LOCK_TTL );

		try {
			$delivery_url = self::build_delivery_url( $merchant_id );

			$webhook = self::load_existing_webhook()
				?? self::find_orphaned_webhook()
				?? new WC_Webhook();

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
		} finally {
			delete_transient( self::LOCK_KEY );
		}
	}

	/**
	 * Return the current health of the Frak-owned webhook, suitable for
	 * rendering a warning banner on the settings page and populating the AJAX
	 * response after a "Set up / Re-enable / Sync" click.
	 *
	 * @return array{
	 *     exists: bool,
	 *     status: string,
	 *     expected_url: string,
	 *     delivery_url: string,
	 *     url_matches: bool,
	 *     topic_matches: bool,
	 *     api_version_matches: bool,
	 *     secret_matches: bool,
	 *     pending_delivery: bool,
	 *     failure_count: int,
	 *     secret_configured: bool,
	 *     merchant_resolved: bool,
	 *     wc_available: bool,
	 *     current_domain: string,
	 *     merchant_domain: string,
	 *     domain_matches: bool,
	 * }
	 */
	public static function status() {
		$merchant_record   = class_exists( 'Frak_Merchant' ) ? Frak_Merchant::get_record() : null;
		$merchant_id       = is_array( $merchant_record ) ? (string) $merchant_record['id'] : '';
		$merchant_domain   = is_array( $merchant_record ) ? (string) $merchant_record['domain'] : '';
		$configured_secret = (string) get_option( 'frak_webhook_secret', '' );
		$secret_configured = '' !== $configured_secret;
		$wc_available      = self::is_wc_available();
		$current_domain    = Frak_Utils::current_host();

		$expected_url = '' !== $merchant_id ? self::build_delivery_url( $merchant_id ) : '';

		$webhook = $wc_available ? self::load_existing_webhook() : null;

		$pending_delivery = false;
		$failure_count    = 0;
		if ( $webhook ) {
			$pending_delivery = (bool) $webhook->get_pending_delivery();
			$failure_count    = (int) $webhook->get_failure_count();
		}

		return array(
			'exists'              => null !== $webhook,
			'status'              => $webhook ? $webhook->get_status() : '',
			'expected_url'        => $expected_url,
			'delivery_url'        => $webhook ? $webhook->get_delivery_url() : '',
			'url_matches'         => $webhook ? $webhook->get_delivery_url() === $expected_url : false,
			'topic_matches'       => $webhook ? $webhook->get_topic() === self::TOPIC : false,
			'api_version_matches' => $webhook ? $webhook->get_api_version() === self::API_VERSION : false,
			// WC stores the secret plain-text, so a direct compare tells us whether
			// the webhook was saved with the current dashboard-issued secret or a
			// stale one (e.g. the admin rotated it in the Frak dashboard but did
			// not re-sync the webhook from here).
			'secret_matches'      => $webhook ? hash_equals( (string) $webhook->get_secret(), $configured_secret ) : false,
			'pending_delivery'    => $pending_delivery,
			'failure_count'       => $failure_count,
			'secret_configured'   => $secret_configured,
			'merchant_resolved'   => '' !== $merchant_id,
			'wc_available'        => $wc_available,
			'current_domain'      => $current_domain,
			'merchant_domain'     => $merchant_domain,
			// Surface a domain drift between the site's current host and the host
			// stamped on the cached merchant record. Drives the "add this domain
			// under Merchant → Allowed Domains" hint on the settings page.
			'domain_matches'      => '' === $merchant_domain || $current_domain === $merchant_domain,
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

	// Normalised host is provided by {@see Frak_Utils::current_host()} so the
	// webhook registrar and the merchant cache agree on the same normalisation
	// (lower-cased, leading `www.` stripped).

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
	 * Locate a previously-owned webhook when the stored id option has drifted
	 * (operator restored a DB backup, deleted the `frak_wc_webhook_id` row, or
	 * the webhook was trashed then recreated manually). Matches by the exact
	 * `WEBHOOK_NAME` + `TOPIC` fingerprint — narrow enough that we won't adopt
	 * an unrelated merchant-owned webhook.
	 */
	private static function find_orphaned_webhook(): ?WC_Webhook {
		if ( ! class_exists( 'WC_Data_Store' ) ) {
			return null;
		}
		$data_store = WC_Data_Store::load( 'webhook' );
		if ( ! method_exists( $data_store, 'search_webhooks' ) ) {
			return null;
		}
		$ids = $data_store->search_webhooks(
			array(
				'search' => self::WEBHOOK_NAME,
				'limit'  => 10,
			)
		);
		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return null;
		}
		foreach ( $ids as $id ) {
			$webhook = wc_get_webhook( (int) $id );
			if (
				$webhook instanceof WC_Webhook
				&& $webhook->get_name() === self::WEBHOOK_NAME
				&& $webhook->get_topic() === self::TOPIC
			) {
				return $webhook;
			}
		}
		return null;
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

	/**
	 * Strip the outgoing webhook payload to the minimum field-set the Frak
	 * backend (`WooCommerceOrderUpdateWebhookDto`) consumes. Runs BEFORE
	 * HMAC signing so the trimmed body is what's signed and shipped — the
	 * receiving end never sees billing/shipping addresses, customer email,
	 * phone, IP, user agent, payment method, customer notes, or arbitrary
	 * `meta_data` from other plugins.
	 *
	 * Allow-list (not deny-list) by design: any new PII field WC or another
	 * plugin adds in the future is dropped automatically until it's
	 * explicitly opted-in here.
	 *
	 * Gates:
	 *   - Only acts on the Frak-owned webhook (id matches stored option), so
	 *     unrelated webhooks on the store keep their full payload.
	 *   - Only acts on `order` resources — leaves the `webhook_id=N` ping and
	 *     any non-order payload alone.
	 *
	 * @param mixed      $payload     Payload built by `WC_Webhook::build_payload()`.
	 * @param string     $resource_name Resource name (e.g. `order`).
	 * @param int|string $resource_id Resource id.
	 * @param int|string $webhook_id  Owning `WC_Webhook` id.
	 * @return mixed Trimmed payload for the Frak webhook, untouched otherwise.
	 */
	public static function filter_payload( $payload, $resource_name, $resource_id, $webhook_id ) {
		unset( $resource_id );

		if ( 'order' !== $resource_name || ! is_array( $payload ) ) {
			return $payload;
		}

		$owned_id = (int) get_option( self::OPTION_ID, 0 );
		if ( ! $owned_id || (int) $webhook_id !== $owned_id ) {
			return $payload;
		}

		return self::strip_payload( $payload );
	}

	/**
	 * Allow-list projection over a WC order payload, mirroring the backend
	 * `WooCommerceOrderUpdateWebhookDto` shape. Keeps every field the DTO
	 * declares (even ones the current handler does not read) so the wire
	 * shape matches the published contract; drops everything else.
	 *
	 * Optional fields are only emitted when present on the source payload —
	 * we don't materialise empty placeholders that would inflate the body or
	 * imply meaning the source didn't intend.
	 *
	 * @param array<string, mixed> $payload Source WC payload.
	 * @return array<string, mixed>
	 */
	private static function strip_payload( array $payload ): array {
		$trimmed = array(
			'id'               => $payload['id'] ?? null,
			'status'           => $payload['status'] ?? null,
			'total'            => $payload['total'] ?? null,
			'currency'         => $payload['currency'] ?? null,
			'date_created_gmt' => $payload['date_created_gmt'] ?? null,
			'customer_id'      => $payload['customer_id'] ?? null,
			'order_key'        => $payload['order_key'] ?? null,
			'transaction_id'   => $payload['transaction_id'] ?? null,
			'line_items'       => self::strip_line_items( $payload['line_items'] ?? array() ),
		);

		foreach ( array( 'date_modified_gmt', 'date_completed_gmt', 'date_paid_gmt' ) as $optional_date ) {
			if ( isset( $payload[ $optional_date ] ) ) {
				$trimmed[ $optional_date ] = $payload[ $optional_date ];
			}
		}

		if ( isset( $payload['refunds'] ) && is_array( $payload['refunds'] ) ) {
			$trimmed['refunds'] = self::strip_refunds( $payload['refunds'] );
		}

		if ( isset( $payload['coupon_lines'] ) && is_array( $payload['coupon_lines'] ) ) {
			$trimmed['coupon_lines'] = self::strip_coupon_lines( $payload['coupon_lines'] );
		}

		return $trimmed;
	}

	/**
	 * Project line-item entries down to the DTO shape. Drops `sku`,
	 * `meta_data`, tax breakdowns, variation ids, parent names, and any other
	 * field WC adds — none are read by the backend handler and `meta_data`
	 * in particular is a free-form bag that other plugins frequently stuff
	 * with PII (gift messages, custom-field input, etc.).
	 *
	 * @param mixed $items Source `line_items` array (defensive — webhook payloads can be malformed).
	 * @return array<int, array<string, mixed>>
	 */
	private static function strip_line_items( $items ): array {
		if ( ! is_array( $items ) ) {
			return array();
		}

		$stripped = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$entry = array(
				'id'         => $item['id'] ?? null,
				'product_id' => $item['product_id'] ?? null,
				'quantity'   => $item['quantity'] ?? null,
				'price'      => $item['price'] ?? null,
				'name'       => $item['name'] ?? null,
			);

			if ( isset( $item['image'] ) && is_array( $item['image'] ) ) {
				$image = array();
				if ( isset( $item['image']['id'] ) ) {
					$image['id'] = $item['image']['id'];
				}
				if ( isset( $item['image']['src'] ) ) {
					$image['src'] = $item['image']['src'];
				}
				$entry['image'] = $image;
			}

			$stripped[] = $entry;
		}

		return $stripped;
	}

	/**
	 * Project refund entries down to the DTO shape. The backend only inspects
	 * `refunds.length > 0` to flip the purchase status to `refunded`, but the
	 * DTO declares `id`, `total`, and an optional `reason`. We keep `id` and
	 * `total` (numeric/financial, not PII) and only forward `reason` when
	 * present so unused entries stay slim.
	 *
	 * @param array<int, mixed> $refunds Source `refunds` array.
	 * @return array<int, array<string, mixed>>
	 */
	private static function strip_refunds( array $refunds ): array {
		$stripped = array();
		foreach ( $refunds as $refund ) {
			if ( ! is_array( $refund ) ) {
				continue;
			}

			$entry = array(
				'id'    => $refund['id'] ?? null,
				'total' => $refund['total'] ?? null,
			);
			if ( isset( $refund['reason'] ) ) {
				$entry['reason'] = $refund['reason'];
			}

			$stripped[] = $entry;
		}

		return $stripped;
	}

	/**
	 * Project coupon-line entries down to the DTO shape. WooCommerce's native
	 * payload exposes `id` / `code` / `discount` / `discount_tax` / `taxes` /
	 * `meta_data` per coupon line; we keep `id` / `code` / `discount` and drop
	 * the rest. Coupon `code` is generally a marketing identifier (`SUMMER20`)
	 * but personalised codes (`JOHN-DOE-25`) can leak customer hints, so we
	 * forward verbatim only the fields the backend's published DTO declares —
	 * `meta_data` in particular is dropped because gift-card / loyalty plugins
	 * frequently stuff PII (recipient email, gift message) onto coupon line
	 * meta and the backend has no use for it.
	 *
	 * @param array<int, mixed> $coupon_lines Source `coupon_lines` array.
	 * @return array<int, array<string, mixed>>
	 */
	private static function strip_coupon_lines( array $coupon_lines ): array {
		$stripped = array();
		foreach ( $coupon_lines as $coupon ) {
			if ( ! is_array( $coupon ) ) {
				continue;
			}

			$stripped[] = array(
				'id'       => $coupon['id'] ?? null,
				'code'     => $coupon['code'] ?? null,
				'discount' => $coupon['discount'] ?? null,
			);
		}

		return $stripped;
	}
}
