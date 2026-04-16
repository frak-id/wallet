<?php
/**
 * Merchant resolver.
 *
 * Owns the lifecycle of the Frak merchant UUID for the current site:
 *   - Lazy-resolves `home_url()` host via `GET /user/merchant/resolve`.
 *   - Caches the result forever (merchant UUIDs are immutable per domain).
 *   - Self-invalidates when the host changes (covers multisite switch_to_blog,
 *     domain renames, CDN origin swaps — no extra hooks needed).
 *   - Short negative cache (5 min transient) on 4xx/5xx so unresolved or
 *     staging domains do not hammer the backend between webhook retries.
 *
 * Storage:
 *   - `frak_merchant` option (autoload=no) — touched only by webhook workers
 *     and the admin settings page, never on frontend requests.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Merchant
 */
class Frak_Merchant {

	/**
	 * Option row holding the resolved merchant record. autoload=no — read only
	 * from the async webhook worker and the admin settings page.
	 */
	public const OPTION_KEY = 'frak_merchant';

	/**
	 * Transient key used to short-circuit repeat resolve attempts after a
	 * failed lookup (network error, 404, malformed body).
	 */
	public const NEGATIVE_CACHE_KEY = 'frak_merchant_unresolved';

	/**
	 * TTL (seconds) for the negative cache. Short enough that a freshly
	 * registered merchant shows up within a few minutes, long enough to
	 * absorb a burst of queued webhooks without N calls to `/resolve`.
	 */
	public const NEGATIVE_CACHE_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * Base URL for the resolve endpoint. Kept as a constant rather than a
	 * setting because the plugin has always hard-coded `backend.frak.id`.
	 */
	public const RESOLVE_URL = 'https://backend.frak.id/user/merchant/resolve';

	/**
	 * Return the merchantId for the current site, resolving lazily on miss.
	 *
	 * Host comparison happens on every call: when the cached `domain` does
	 * not match the current `home_url()` host, the cache is treated as
	 * unusable and a fresh resolve is attempted. This is what covers
	 * multisite and domain-change scenarios without explicit hooks.
	 *
	 * @return string|null UUID on success, null when unresolved.
	 */
	public static function get_id() {
		$record = self::get_record();
		return $record['id'] ?? null;
	}

	/**
	 * Return the full cached merchant record for the current host, or null
	 * when the domain is unresolved. Preferred entry point for the admin UI.
	 *
	 * @return array{id:string,name:string,domain:string,resolved_at:int}|null
	 */
	public static function get_record() {
		$host = self::current_host();
		if ( '' === $host ) {
			return null;
		}

		$cached = get_option( self::OPTION_KEY, null );
		if ( is_array( $cached ) && ! empty( $cached['id'] ) && ( $cached['domain'] ?? '' ) === $host ) {
			return $cached;
		}

		if ( get_transient( self::NEGATIVE_CACHE_KEY ) ) {
			return null;
		}

		return self::resolve( $host );
	}

	/**
	 * Drop any cached merchant record. Called by:
	 *   - The admin "Refresh" button.
	 *   - The webhook dispatcher when the backend replies with
	 *     `ko: Webhook not found`, which indicates the cached UUID no longer
	 *     maps to a live merchant (delete-and-recreate scenario).
	 */
	public static function invalidate(): void {
		delete_option( self::OPTION_KEY );
		delete_transient( self::NEGATIVE_CACHE_KEY );
	}

	/**
	 * Perform the HTTP resolve and persist the result.
	 *
	 * Failures (network error, non-200, malformed payload, missing merchantId)
	 * all fall through to the same negative-cache branch so an unregistered
	 * domain does not blow up the webhook retry budget.
	 *
	 * @param string $host Normalized domain.
	 * @return array{id:string,name:string,domain:string,resolved_at:int}|null
	 */
	private static function resolve( $host ) {
		$response = wp_remote_get(
			add_query_arg( 'domain', $host, self::RESOLVE_URL ),
			array(
				'timeout' => 5,
				'headers' => array( 'Accept' => 'application/json' ),
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			set_transient( self::NEGATIVE_CACHE_KEY, 1, self::NEGATIVE_CACHE_TTL );
			return null;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) || empty( $data['merchantId'] ) ) {
			set_transient( self::NEGATIVE_CACHE_KEY, 1, self::NEGATIVE_CACHE_TTL );
			return null;
		}

		$record = array(
			'id'          => (string) $data['merchantId'],
			'name'        => isset( $data['name'] ) ? (string) $data['name'] : '',
			'domain'      => $host,
			'resolved_at' => time(),
		);

		update_option( self::OPTION_KEY, $record, false );
		delete_transient( self::NEGATIVE_CACHE_KEY );
		return $record;
	}

	/**
	 * Return the current `home_url()` host, lower-cased and with a leading
	 * `www.` stripped so the cache key aligns with the backend's
	 * normalization (see `MerchantRepository::getNormalizedDomain`).
	 *
	 * @return string Empty string when the host cannot be determined.
	 */
	private static function current_host() {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( ! is_string( $host ) || '' === $host ) {
			return '';
		}
		$host = strtolower( $host );
		if ( 0 === strpos( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}
}
