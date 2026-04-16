<?php
/**
 * Frak Webhook Helper.
 *
 * @package Frak_Integration
 */


/**
 * Class for handling webhook operations.
 */
class Frak_Webhook_Helper {

	/**
	 * `wp_cache` group + key used by the in-memory webhook log ring buffer.
	 * We intentionally avoid `wp_options` (which would rewrite a serialized
	 * array on every webhook dispatch) and live with a non-persistent buffer
	 * on sites without a persistent object cache — the logs are diagnostic,
	 * not a source of truth, so ephemeral storage is acceptable.
	 */
	private const LOG_CACHE_GROUP = 'frak';
	private const LOG_CACHE_KEY   = 'webhook_logs';

	/**
	 * Hard cap on the number of log entries kept in the ring buffer.
	 */
	private const LOG_MAX_ENTRIES = 20;

	/**
	 * Get the webhook URL for the resolved merchant, or null when the
	 * site's domain has not yet been resolved to a Frak merchantId.
	 *
	 * The merchantId is resolved lazily on first access via Frak_Merchant,
	 * so this stays free on every request that does not actually dispatch.
	 *
	 * @return string|null
	 */
	public static function get_webhook_url() {
		$merchant_id = Frak_Merchant::get_id();
		if ( ! $merchant_id ) {
			return null;
		}
		return 'https://backend.frak.id/ext/merchant/' . rawurlencode( $merchant_id ) . '/webhook/custom';
	}

	/**
	 * Send webhook for order.
	 *
	 * @param int    $order_id Order ID.
	 * @param string $status   Order status.
	 * @param string $token    Token.
	 * @return array
	 * @throws Exception When the order is not found, webhook secret is missing, payload encoding fails, or the HTTP response indicates an error.
	 */
	public static function send( $order_id, $status, $token ) {
		$start_time  = microtime( true );
		$webhook_url = self::get_webhook_url();

		try {
			if ( null === $webhook_url ) {
				throw new Exception( 'Merchant not resolved — webhook URL unavailable' );
			}

			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				throw new Exception( 'Order not found: ' . $order_id );
			}

			$items = array();
			foreach ( $order->get_items() as $item ) {
				if ( ! $item instanceof WC_Order_Item_Product ) {
					continue;
				}
				$product = $item->get_product();
				$items[] = array(
					'productId' => $product ? $product->get_id() : 0,
					'quantity'  => $item->get_quantity(),
					'price'     => (float) $item->get_total() / $item->get_quantity(),
					'name'      => $item->get_name(),
					'title'     => $item->get_name(),
				);
			}

			$webhook_secret = get_option( 'frak_webhook_secret' );
			if ( empty( $webhook_secret ) ) {
				throw new Exception( 'Webhook secret not configured' );
			}

			$body = array(
				'id'         => $order_id,
				'customerId' => $order->get_customer_id(),
				'status'     => $status,
				'token'      => $token . '_' . $order_id,
				'currency'   => $order->get_currency(),
				'totalPrice' => $order->get_total(),
				'items'      => $items,
			);

			$json_body = wp_json_encode( $body );
			if ( ! $json_body ) {
				throw new Exception( 'Failed to encode webhook payload as JSON' );
			}

			$signature = base64_encode( hash_hmac( 'sha256', $json_body, $webhook_secret, true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required for HMAC signature header.

			$response = wp_remote_post(
				$webhook_url,
				array(
					'body'    => $json_body,
					'headers' => array(
						'Content-Type'  => 'application/json',
						'x-hmac-sha256' => $signature,
					),
					'timeout' => 30,
				)
			);

			$execution_time = round( ( microtime( true ) - $start_time ) * 1000, 2 );

			if ( is_wp_error( $response ) ) {
				throw new Exception( 'WordPress error: ' . $response->get_error_message() );
			}

			$http_code     = wp_remote_retrieve_response_code( $response );
			$response_body = wp_remote_retrieve_body( $response );

			self::log_webhook_attempt( $order_id, $status, $http_code, $response_body, $execution_time, null );

			if ( $http_code >= 200 && $http_code < 300 ) {
				// Backend returns HTTP 200 with a `ko: <message>` body on semantic
				// failures. A `Webhook not found` reply means the cached merchantId
				// no longer maps to a live merchant (delete-and-recreate scenario),
				// so drop the cache and let Action Scheduler retry with a fresh resolve.
				if ( 0 === strncmp( $response_body, 'ko: Webhook not found', 21 ) ) {
					Frak_Merchant::invalidate();
					throw new Exception( 'Webhook not found (cache invalidated, will retry)' );
				}
				return array(
					'success'   => true,
					'http_code' => $http_code,
					'response'  => $response_body,
				);
			} else {
				throw new Exception( 'HTTP error: ' . $http_code . ', Response: ' . $response_body );
			}
		} catch ( Exception $e ) {
			$execution_time = round( ( microtime( true ) - $start_time ) * 1000, 2 );
			self::log_webhook_attempt(
				$order_id,
				$status,
				isset( $http_code ) ? $http_code : 0,
				isset( $response_body ) ? $response_body : '',
				$execution_time,
				$e->getMessage()
			);

			return array(
				'success'        => false,
				'error'          => $e->getMessage(),
				'execution_time' => $execution_time,
			);
		}
	}

	/**
	 * Log webhook attempt.
	 *
	 * @param int         $order_id       Order ID.
	 * @param string      $status         Status.
	 * @param int         $http_code      HTTP code.
	 * @param string      $response       Response.
	 * @param float       $execution_time Execution time.
	 * @param string|null $error          Error message.
	 */
	private static function log_webhook_attempt( $order_id, $status, $http_code, $response, $execution_time, $error = null ) {
		$data = array(
			'order_id'       => intval( $order_id ),
			'status'         => sanitize_text_field( $status ),
			'http_code'      => intval( $http_code ),
			'response'       => substr( sanitize_text_field( $response ), 0, 1000 ),
			'execution_time' => floatval( $execution_time ),
			'error'          => $error ? substr( sanitize_text_field( $error ), 0, 500 ) : null,
			'timestamp'      => current_time( 'mysql' ),
			'success'        => null === $error && $http_code >= 200 && $http_code < 300 ? 1 : 0,
		);

		$logs = self::read_logs();
		array_unshift( $logs, $data );
		$logs = array_slice( $logs, 0, self::LOG_MAX_ENTRIES );

		wp_cache_set( self::LOG_CACHE_KEY, $logs, self::LOG_CACHE_GROUP );
	}

	/**
	 * Read the ring buffer from the object cache. Returns an empty array when
	 * nothing has been written yet (or on sites without a persistent cache,
	 * after the originating request has ended).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function read_logs() {
		$logs = wp_cache_get( self::LOG_CACHE_KEY, self::LOG_CACHE_GROUP );
		return is_array( $logs ) ? $logs : array();
	}

	/**
	 * Get recent webhook logs.
	 *
	 * @param int $limit Limit.
	 * @return array
	 */
	public static function get_webhook_logs( $limit = 20 ) {
		return array_slice( self::read_logs(), 0, $limit );
	}

	/**
	 * Get webhook statistics.
	 *
	 * @return array
	 */
	public static function get_webhook_stats() {
		$logs = self::get_webhook_logs( 50 );

		if ( empty( $logs ) ) {
			return array(
				'total_attempts'    => 0,
				'successful'        => 0,
				'failed'            => 0,
				'success_rate'      => 0,
				'avg_response_time' => 0,
				'last_attempt'      => null,
			);
		}

		$total_attempts = count( $logs );
		$successful     = count(
			array_filter(
				$logs,
				function ( $log ) {
					return $log['success'];
				}
			)
		);
		$failed         = $total_attempts - $successful;
		$success_rate   = round( ( $successful / $total_attempts ) * 100, 1 );

		$total_time        = array_sum( array_column( $logs, 'execution_time' ) );
		$avg_response_time = round( $total_time / $total_attempts, 2 );

		return array(
			'total_attempts'    => $total_attempts,
			'successful'        => $successful,
			'failed'            => $failed,
			'success_rate'      => $success_rate,
			'avg_response_time' => $avg_response_time,
			'last_attempt'      => $logs[0]['timestamp'] ?? null,
		);
	}

	/**
	 * Clear webhook logs.
	 */
	public static function clear_webhook_logs() {
		wp_cache_delete( self::LOG_CACHE_KEY, self::LOG_CACHE_GROUP );
	}
}
