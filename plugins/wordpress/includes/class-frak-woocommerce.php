<?php
/**
 * WooCommerce integration.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_WooCommerce
 *
 * Stateless hook container — all handlers are static so no instance is held
 * in memory between requests. Hooks are registered in {@see init()}.
 */
class Frak_WooCommerce {

	/**
	 * Set by the `frak/post-purchase` block when it renders with auto-
	 * injected order context. When true, the dedicated tracker callback
	 * (hooked to `woocommerce_thankyou` / `woocommerce_view_order`) skips
	 * itself — the block's `<frak-post-purchase>` web component fires
	 * `trackPurchaseStatus` on its own and we avoid a duplicate SDK call.
	 *
	 * @var bool
	 */
	private static $tracking_populated = false;

	/**
	 * Register WooCommerce hooks. Called once from {@see Frak_Plugin::init()}.
	 *
	 * Tracker registration uses `woocommerce_thankyou` and `woocommerce_view_order`
	 * instead of a universal `wp_footer` listener so the callback only runs on
	 * the exact two endpoints that carry an order — every other frontend page
	 * pays zero PHP for tracking.
	 */
	public static function init() {
		add_action( 'woocommerce_thankyou', array( __CLASS__, 'render_purchase_tracker_for_order' ) );
		add_action( 'woocommerce_view_order', array( __CLASS__, 'render_purchase_tracker_for_order' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'handle_order_status_change' ), 10, 4 );
		add_action( 'frak_dispatch_webhook', array( __CLASS__, 'dispatch_webhook' ), 10, 3 );
	}

	/**
	 * Resolve the WooCommerce order context for the current request.
	 *
	 * Supports two order-scoped endpoints:
	 *   - `order-received` (post-checkout thank-you page): public, guarded
	 *     by the `key` query arg matching the stored order key — the same
	 *     anti-enumeration check WooCommerce's own template performs.
	 *   - `view-order` (My Account → Orders → View): authenticated, guarded
	 *     by the `view_order` meta capability (current user must own the
	 *     order, or be a shop manager).
	 *
	 * Returns null on any other endpoint or when the guard fails.
	 *
	 * Shared by the `frak/post-purchase` block (to auto-inject HTML
	 * attributes) and {@see render_purchase_tracker()} (for its payload).
	 *
	 * @return array<string, string>|null Map of HTML attribute name → value.
	 */
	public static function get_order_context() {
		if ( ! function_exists( 'is_wc_endpoint_url' ) ) {
			return null;
		}

		global $wp;
		$order = null;

		if ( is_wc_endpoint_url( 'order-received' ) ) {
			$order_id = isset( $wp->query_vars['order-received'] ) ? absint( $wp->query_vars['order-received'] ) : 0;
			if ( ! $order_id ) {
				return null;
			}
			$candidate = wc_get_order( $order_id );
			if ( ! $candidate ) {
				return null;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Public endpoint; mirrors WooCommerce's own thank-you key check.
			$url_key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';
			if ( '' === $url_key || $url_key !== $candidate->get_order_key() ) {
				return null;
			}
			$order = $candidate;
		} elseif ( is_wc_endpoint_url( 'view-order' ) ) {
			$order_id = isset( $wp->query_vars['view-order'] ) ? absint( $wp->query_vars['view-order'] ) : 0;
			if ( ! $order_id || ! current_user_can( 'view_order', $order_id ) ) {
				return null;
			}
			$candidate = wc_get_order( $order_id );
			if ( ! $candidate ) {
				return null;
			}
			$order = $candidate;
		}

		if ( ! $order ) {
			return null;
		}

		$order_id = $order->get_id();

		return array(
			'customer-id' => (string) $order->get_user_id(),
			'order-id'    => (string) $order_id,
			'token'       => $order->get_order_key() . '_' . $order_id,
		);
	}

	/**
	 * Flag that the `frak/post-purchase` block already rendered with order
	 * context, so the `wp_footer` inline tracker should not fire.
	 */
	public static function mark_tracking_populated() {
		self::$tracking_populated = true;
	}

	/**
	 * Inline tracker fired from `woocommerce_thankyou` and `woocommerce_view_order`
	 * — ensures reward attribution works even when the merchant has not placed
	 * the `frak/post-purchase` block on their template. No-ops when the block
	 * populated the context (avoids double-firing).
	 *
	 * WooCommerce has already run its own endpoint + capability checks before
	 * firing these actions, so we trust the `$order_id` argument and skip the
	 * URL-key / `view_order` guard that {@see get_order_context()} performs.
	 *
	 * @param int $order_id Order ID provided by the WooCommerce action.
	 */
	public static function render_purchase_tracker_for_order( $order_id ) {
		if ( self::$tracking_populated ) {
			return;
		}

		$order_id = absint( $order_id );
		if ( ! $order_id ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$payload = array(
			'customerId' => (string) $order->get_user_id(),
			'orderId'    => (string) $order_id,
			'token'      => $order->get_order_key() . '_' . $order_id,
		);

		$payload_json = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES );

		// Fires the tracking call as soon as the SDK client is ready. The
		// synchronous pre-check covers the case where the SDK bootstraps
		// before this inline script runs.
		$script = sprintf(
			'(function(p){var f=function(){var s=window.FrakSetup;if(s&&s.core&&s.core.trackPurchaseStatus){s.core.trackPurchaseStatus(p);return true;}return false;};if(!f())window.addEventListener("frak:client",f,{once:true});})(%s);',
			$payload_json
		);

		wp_print_inline_script_tag( $script, array( 'id' => 'frak-purchase-tracker-inline' ) );
	}

	/**
	 * React to an order status change by scheduling a webhook dispatch.
	 *
	 * The blocking HTTP call is NOT performed here — it is queued via Action
	 * Scheduler (or WP-Cron as fallback) so the order-status request is not
	 * held hostage by the Frak backend's response time.
	 *
	 * @param int      $order_id   Order ID.
	 * @param string   $old_status Old status (unused, kept for signature compatibility).
	 * @param string   $new_status New status.
	 * @param WC_Order $order      Order object.
	 */
	public static function handle_order_status_change( $order_id, $old_status, $new_status, $order ) {
		unset( $old_status );

		$skip_statuses = array( 'checkout-draft', 'auto-draft' );
		if ( in_array( $new_status, $skip_statuses, true ) ) {
			$order->add_order_note(
				/* translators: %s: order status */
				sprintf( __( 'Frak: Skipping webhook for status: %s', 'frak' ), $new_status )
			);
			return;
		}

		// Read the webhook secret only after the cheap skip checks above so the
		// fast-path for ignored statuses does not hit `wp_options`.
		if ( empty( get_option( 'frak_webhook_secret' ) ) ) {
			return;
		}

		$status_map = array(
			'completed'  => 'confirmed',
			'processing' => 'pending',
			'on-hold'    => 'pending',
			'pending'    => 'pending',
			'cancelled'  => 'cancelled',
			'refunded'   => 'refunded',
			'failed'     => 'cancelled',
		);
		$webhook_status = $status_map[ $new_status ] ?? 'pending';

		$order->add_order_note(
			/* translators: %s: webhook status */
			sprintf( __( 'Frak: Queued webhook with status: %s', 'frak' ), $webhook_status )
		);

		// Defer the outbound HTTP call to a worker. Action Scheduler ships with
		// WooCommerce >= 3.3 and gives us retries + a UI under
		// WooCommerce > Status > Scheduled Actions; the WP-Cron fallback keeps
		// old installs working.
		$args = array( $order_id, $webhook_status, $order->get_order_key() );
		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( 'frak_dispatch_webhook', $args, 'frak' );
		} else {
			wp_schedule_single_event( time(), 'frak_dispatch_webhook', $args );
		}
	}

	/**
	 * Async worker invoked by the `frak_dispatch_webhook` action. Performs the
	 * actual HTTP POST and records the outcome as an order note so the merchant
	 * still has per-order visibility into webhook delivery.
	 *
	 * @param int    $order_id       Order ID.
	 * @param string $webhook_status Mapped webhook status.
	 * @param string $token          Order key used to sign the payload token.
	 */
	public static function dispatch_webhook( $order_id, $webhook_status, $token ) {
		$result = Frak_Webhook_Helper::send( $order_id, $webhook_status, $token );

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		if ( $result['success'] ) {
			$order->add_order_note( __( 'Frak: Webhook sent successfully', 'frak' ) );
			return;
		}

		$order->add_order_note(
			/* translators: %s: error message */
			sprintf( __( 'Frak: Webhook failed: %s', 'frak' ), $result['error'] )
		);
	}
}
