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
	 * Register WooCommerce hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'woocommerce_thankyou', array( __CLASS__, 'render_purchase_tracker' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'handle_order_status_change' ), 10, 4 );
	}

	/**
	 * Emit the purchase-tracking call on the WooCommerce thank-you page.
	 *
	 * Instead of rendering the `<frak-post-purchase>` UI component (which is
	 * now exposed as a Gutenberg block), this hook fires the core SDK action
	 * `trackPurchaseStatus` so reward attribution still works even when the
	 * merchant never drops the block onto the thank-you template. Auth is
	 * handled by the SDK (reads `frak-wallet-interaction-token` from
	 * sessionStorage + `frak-client-id` from localStorage).
	 *
	 * @param int $order_id Order ID.
	 */
	public static function render_purchase_tracker( $order_id ) {
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
