<?php
/**
 * Frak Webhook Helper.
 *
 * @package Frak_Integration
 */

use kornrunner\Keccak;

/**
 * Class for handling webhook operations.
 */
class Frak_Webhook_Helper {

	/**
	 * Get the product ID based on the site domain.
	 *
	 * @return string
	 */
	public static function get_product_id() {
		$domain = wp_parse_url( home_url(), PHP_URL_HOST );
		$domain = str_replace( array( 'www.' ), '', $domain );
		$hash   = Keccak::hash( $domain, 256 );
		return '0x' . $hash;
	}

	/**
	 * Get the webhook URL.
	 *
	 * @return string
	 */
	public static function get_webhook_url() {
		$product_id = self::get_product_id();
		return 'https://backend.frak.id/ext/products/' . $product_id . '/webhook/oracle/custom';
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
			'webhook_url'    => self::get_webhook_url(),
			'success'        => null === $error && $http_code >= 200 && $http_code < 300 ? 1 : 0,
		);

		$existing_logs = get_option( 'frak_webhook_logs', array() );
		if ( ! is_array( $existing_logs ) ) {
			$existing_logs = array();
		}

		array_unshift( $existing_logs, $data );
		$existing_logs = array_slice( $existing_logs, 0, 50 );

		update_option( 'frak_webhook_logs', $existing_logs );
	}

	/**
	 * Get recent webhook logs.
	 *
	 * @param int $limit Limit.
	 * @return array
	 */
	public static function get_webhook_logs( $limit = 20 ) {
		$logs = get_option( 'frak_webhook_logs', array() );
		if ( ! is_array( $logs ) ) {
			return array();
		}
		return array_slice( $logs, 0, $limit );
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
		update_option( 'frak_webhook_logs', array() );
	}

	/**
	 * Test webhook connectivity.
	 *
	 * @return array
	 * @throws Exception When the webhook secret is missing or the HTTP response indicates an error.
	 */
	public static function test_webhook() {
		$start_time  = microtime( true );
		$webhook_url = self::get_webhook_url();

		try {
			$test_payload = array(
				'test'      => true,
				'timestamp' => time(),
				'domain'    => wp_parse_url( home_url(), PHP_URL_HOST ),
			);

			$json_body      = wp_json_encode( $test_payload );
			$webhook_secret = get_option( 'frak_webhook_secret' );

			if ( empty( $webhook_secret ) ) {
				throw new Exception( 'Webhook secret not configured' );
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

			$result = array(
				'success'        => $http_code >= 200 && $http_code < 300,
				'http_code'      => $http_code,
				'response'       => $response_body,
				'execution_time' => $execution_time,
				'error'          => null,
			);

			if ( ! $result['success'] ) {
				$result['error'] = 'HTTP error: ' . $http_code;
			}

			return $result;
		} catch ( Exception $e ) {
			$execution_time = round( ( microtime( true ) - $start_time ) * 1000, 2 );

			return array(
				'success'        => false,
				'http_code'      => 0,
				'response'       => '',
				'execution_time' => $execution_time,
				'error'          => $e->getMessage(),
			);
		}
	}

	/**
	 * Check webhook status.
	 *
	 * @return bool
	 */
	public static function get_webhook_status() {
		$product_id = self::get_product_id();
		$url        = 'https://backend.frak.id/business/product/' . $product_id . '/oracleWebhook/status';

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 10,
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $http_code ) {
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return false;
		}

		return isset( $data['setup'] ) && true === $data['setup'];
	}
}
