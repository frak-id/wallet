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
 *   - Remembers the {@see Frak_Env} the record was resolved in: a record from
 *     another environment is dropped and re-resolved, so flipping `FRAK_ENV`
 *     never leaves a foreign merchant id behind.
 *
 * Storage:
 *   - `frak_merchant` option (autoload=no) — touched by webhook workers, the
 *     admin settings page and, after a `FRAK_ENV` flip, the first admin
 *     request (`admin_init`); never on frontend requests.
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
	 * Production transient key used to short-circuit repeat resolve attempts
	 * after a failed lookup (network error, 404, malformed body). The dev
	 * stack appends `_dev`, see {@see negative_cache_key()}.
	 */
	public const NEGATIVE_CACHE_KEY = 'frak_merchant_unresolved';

	/**
	 * TTL (seconds) for the negative cache. Short enough that a freshly
	 * registered merchant shows up within a few minutes, long enough to
	 * absorb a burst of queued webhooks without N calls to `/resolve`.
	 */
	public const NEGATIVE_CACHE_TTL = 5 * MINUTE_IN_SECONDS;

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
	 * @return array{id:string,name:string,domain:string,resolved_at:int,env:string}|null
	 */
	public static function get_record() {
		$host = Frak_Utils::current_host();
		if ( '' === $host ) {
			return null;
		}

		$cached = get_option( self::OPTION_KEY, null );
		if ( self::is_foreign( $cached ) ) {
			delete_option( self::OPTION_KEY );
			$record = get_transient( self::negative_cache_key() ) ? null : self::resolve( $host );
			// The WooCommerce webhook still targets the other environment's backend; ensure() recreates it on the next resolve.
			if ( null === $record ) {
				Frak_WC_Webhook_Registrar::remove();
			}
			return $record;
		}

		if ( is_array( $cached ) && ! empty( $cached['id'] ) && ( $cached['domain'] ?? '' ) === $host ) {
			return $cached;
		}

		if ( get_transient( self::negative_cache_key() ) ) {
			return null;
		}

		return self::resolve( $host );
	}

	/**
	 * Whether a stored record was resolved in another environment than the
	 * current one. Records written before the `env` field existed are
	 * production.
	 */
	public static function has_foreign_record(): bool {
		return self::is_foreign( get_option( self::OPTION_KEY, null ) );
	}

	/**
	 * Whether a stored option value is a record from another environment.
	 *
	 * @param mixed $cached Raw `frak_merchant` option value.
	 */
	private static function is_foreign( $cached ): bool {
		return is_array( $cached ) && ( $cached['env'] ?? 'prod' ) !== Frak_Env::name();
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
		delete_transient( self::NEGATIVE_CACHE_KEY . '_dev' );
	}

	/**
	 * Negative-cache transient key for the current environment, so a failed
	 * dev lookup never blocks the production one (nor the reverse).
	 */
	private static function negative_cache_key(): string {
		return Frak_Env::is_dev() ? self::NEGATIVE_CACHE_KEY . '_dev' : self::NEGATIVE_CACHE_KEY;
	}

	/**
	 * Perform the HTTP resolve and persist the result.
	 *
	 * Failures (network error, non-200, malformed payload, missing merchantId)
	 * all fall through to the same negative-cache branch so an unregistered
	 * domain does not blow up the webhook retry budget.
	 *
	 * @param string $host Normalized domain.
	 * @return array{id:string,name:string,domain:string,resolved_at:int,env:string}|null
	 */
	private static function resolve( $host ) {
		$response = wp_remote_get(
			add_query_arg( 'domain', $host, Frak_Env::backend_base() . '/user/merchant/resolve' ),
			array(
				'timeout' => 5,
				'headers' => array( 'Accept' => 'application/json' ),
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			set_transient( self::negative_cache_key(), 1, self::NEGATIVE_CACHE_TTL );
			return null;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) || empty( $data['merchantId'] ) ) {
			set_transient( self::negative_cache_key(), 1, self::NEGATIVE_CACHE_TTL );
			return null;
		}

		$record = array(
			'id'          => (string) $data['merchantId'],
			'name'        => isset( $data['name'] ) ? (string) $data['name'] : '',
			'domain'      => $host,
			'resolved_at' => time(),
			'env'         => Frak_Env::name(),
		);

		update_option( self::OPTION_KEY, $record, false );
		delete_transient( self::negative_cache_key() );
		return $record;
	}
}
