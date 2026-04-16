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
		add_action( 'woocommerce_thankyou', array( __CLASS__, 'render_post_purchase' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'handle_order_status_change' ), 10, 4 );
	}

	/**
	 * Render the <frak-post-purchase> web component on the thank-you page.
	 *
	 * Replaces the previous inline fetch() call — the SDK component handles
	 * authentication (x-wallet-sdk-auth header pulled from sessionStorage),
	 * merchant resolution, and renders a "Share & Earn" UI.
	 *
	 * @param int $order_id Order ID.
	 */
	public static function render_post_purchase( $order_id ) {
		if ( ! $order_id ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		printf(
			'<frak-post-purchase customer-id="%s" order-id="%s" token="%s"></frak-post-purchase>',
			esc_attr( (string) $order->get_user_id() ),
			esc_attr( (string) $order_id ),
			esc_attr( $order->get_order_key() . '_' . $order_id )
		);
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
