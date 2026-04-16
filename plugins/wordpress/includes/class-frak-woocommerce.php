<?php
/**
 * WooCommerce integration.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_WooCommerce
 */
class Frak_WooCommerce {

	/**
	 * Singleton instance.
	 *
	 * @var Frak_WooCommerce|null
	 */
	private static $instance = null;

	/**
	 * Get singleton instance.
	 *
	 * @return Frak_WooCommerce
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
		add_action( 'woocommerce_thankyou', array( $this, 'track_purchase' ) );
		add_action( 'woocommerce_order_status_changed', array( $this, 'handle_order_status_change' ), 10, 4 );
	}

	/**
	 * Track purchase on thank-you page.
	 *
	 * @param int $order_id Order ID.
	 */
	public function track_purchase( $order_id ) {
		if ( ! $order_id ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$customer_id = $order->get_user_id();
		$order_key   = $order->get_order_key();

		wp_register_script( 'frak-purchase-tracking', false ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- inline-only handle.
		wp_enqueue_script( 'frak-purchase-tracking' );

		$tracking_script = $this->get_tracking_script( $customer_id, $order_id, $order_key );
		wp_add_inline_script( 'frak-purchase-tracking', $tracking_script );
	}

	/**
	 * Get the tracking script for a purchase.
	 *
	 * @param int    $customer_id Customer ID.
	 * @param int    $order_id    Order ID.
	 * @param string $order_key   Order key.
	 * @return string
	 */
	private function get_tracking_script( $customer_id, $order_id, $order_key ) {
		$payload = array(
			'customerId' => $customer_id,
			'orderId'    => $order_id,
			'token'      => $order_key . '_' . $order_id,
		);

		return "
        (function() {
            try {
                const interactionToken = sessionStorage.getItem('frak-wallet-interaction-token');
                if (interactionToken) {
                    fetch('https://backend.frak.id/wallet/interactions/listenForPurchase', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'x-wallet-sdk-auth': interactionToken
                        },
                        body: JSON.stringify(" . wp_json_encode( $payload ) . ")
                    }).catch(error => {
                        console.error('Frak purchase tracking error:', error);
                    });
                }
            } catch (error) {
                console.error('Frak purchase tracking error:', error);
            }
        })();";
	}

	/**
	 * Handle order status changes.
	 *
	 * @param int    $order_id   Order ID.
	 * @param string $old_status Old status.
	 * @param string $new_status New status.
	 * @param object $order      Order object.
	 */
	public function handle_order_status_change( $order_id, $old_status, $new_status, $order ) {
		$webhook_secret = get_option( 'frak_webhook_secret' );
		if ( empty( $webhook_secret ) ) {
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

		$skip_statuses = array( 'checkout-draft', 'auto-draft' );

		if ( in_array( $new_status, $skip_statuses, true ) ) {
			$order->add_order_note(
				/* translators: %s: order status */
				sprintf( __( 'Frak: Skipping webhook for status: %s', 'frak' ), $new_status )
			);
			return;
		}

		$webhook_status = isset( $status_map[ $new_status ] ) ? $status_map[ $new_status ] : 'pending';
		$token          = $order->get_order_key();

		$order->add_order_note(
			/* translators: %s: webhook status */
			sprintf( __( 'Frak: Sending webhook with status: %s', 'frak' ), $webhook_status )
		);

		$result = Frak_Webhook_Helper::send( $order_id, $webhook_status, $token );

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
