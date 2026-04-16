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
	 * injected order context. When true, the inline `wp_footer` fallback
	 * skips itself — the block's `<frak-post-purchase>` web component fires
	 * `trackPurchaseStatus` on its own and we avoid a duplicate SDK call.
	 *
	 * @var bool
	 */
	private static $tracking_populated = false;

	/**
	 * Register WooCommerce hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'wp_footer', array( __CLASS__, 'render_purchase_tracker' ), 20 );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'handle_order_status_change' ), 10, 4 );
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
	 * Fallback inline tracker fired in `wp_footer` — ensures reward
	 * attribution works even when the merchant has not placed the
	 * `frak/post-purchase` block on their thank-you template. No-ops when
	 * the block populated the context (avoids double-firing).
	 */
	public static function render_purchase_tracker() {
		if ( self::$tracking_populated ) {
			return;
		}

		$context = self::get_order_context();
		if ( null === $context ) {
			return;
		}

		$payload = array(
			'customerId' => $context['customer-id'],
			'orderId'    => $context['order-id'],
			'token'      => $context['token'],
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
	 * Send webhook when an order status changes.
	 *
	 * @param int      $order_id   Order ID.
	 * @param string   $old_status Old status (unused, kept for signature compatibility).
	 * @param string   $new_status New status.
	 * @param WC_Order $order      Order object.
	 */
	public static function handle_order_status_change( $order_id, $old_status, $new_status, $order ) {
		unset( $old_status );

		if ( empty( get_option( 'frak_webhook_secret' ) ) ) {
			return;
		}

		$skip_statuses = array( 'checkout-draft', 'auto-draft' );
		if ( in_array( $new_status, $skip_statuses, true ) ) {
			$order->add_order_note(
				/* translators: %s: order status */
				sprintf( __( 'Frak: Skipping webhook for status: %s', 'frak' ), $new_status )
			);
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
			sprintf( __( 'Frak: Sending webhook with status: %s', 'frak' ), $webhook_status )
		);

		$result = Frak_Webhook_Helper::send( $order_id, $webhook_status, $order->get_order_key() );

		if ( $result['success'] ) {
			$order->add_order_note( __( 'Frak: Webhook sent successfully', 'frak' ) );
		} else {
			$order->add_order_note(
				/* translators: %s: error message */
				sprintf( __( 'Frak: Webhook failed: %s', 'frak' ), $result['error'] )
			);
		}
	}
}
