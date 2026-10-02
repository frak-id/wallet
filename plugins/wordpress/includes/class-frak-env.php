<?php
/**
 * Environment switch.
 *
 * Single owner of every origin the plugin talks to, driven by two optional
 * `wp-config.php` constants:
 *   - `FRAK_ENV`: only the string `dev` switches the plugin to the dev stack;
 *     any other defined value is production and reported as ignored.
 *   - `FRAK_MERCHANT_DOMAIN`: the merchant domain the site acts as, for both
 *     the plugin's merchant lookup and the SDK in the browser.
 *
 * With neither constant defined, every method returns today's production value.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Env
 */
class Frak_Env {

	/**
	 * Whether the dev stack is active (`FRAK_ENV` is exactly `dev`).
	 */
	public static function is_dev(): bool {
		return defined( 'FRAK_ENV' ) && 'dev' === constant( 'FRAK_ENV' );
	}

	/**
	 * Short environment name stored on the merchant record and used to key
	 * the negative cache.
	 *
	 * @return string `dev` or `prod`.
	 */
	public static function name(): string {
		return self::is_dev() ? 'dev' : 'prod';
	}

	/**
	 * The `FRAK_ENV` value when it is defined but not `dev` (so ignored), or
	 * null when it is unset or valid.
	 */
	public static function ignored_value(): ?string {
		if ( ! defined( 'FRAK_ENV' ) || self::is_dev() ) {
			return null;
		}
		$value = constant( 'FRAK_ENV' );
		return is_string( $value ) ? $value : (string) wp_json_encode( $value );
	}

	/**
	 * Host of the SDK pointer serving the `components.js` shim.
	 */
	public static function sdk_host(): string {
		return self::is_dev() ? 'https://sdk-dev.frak.id' : 'https://sdk.frak.id';
	}

	/**
	 * Dist-tag of the jsDelivr fallback shim, paired with the pointer.
	 */
	public static function jsdelivr_tag(): string {
		return self::is_dev() ? 'beta' : 'latest';
	}

	/**
	 * Base URL of the Frak backend, without a trailing slash.
	 */
	public static function backend_base(): string {
		return self::is_dev() ? 'https://backend.gcp-dev.frak.id' : 'https://backend.frak.id';
	}

	/**
	 * Origin of the Frak business dashboard, without a trailing slash.
	 */
	public static function dashboard_origin(): string {
		return self::is_dev() ? 'https://business-dev.frak.id' : 'https://business.frak.id';
	}

	/**
	 * The `FRAK_MERCHANT_DOMAIN` override, normalised like
	 * {@see Frak_Utils::current_host()}, or an empty string when unset.
	 */
	public static function merchant_domain(): string {
		if ( ! defined( 'FRAK_MERCHANT_DOMAIN' ) || ! is_string( constant( 'FRAK_MERCHANT_DOMAIN' ) ) ) {
			return '';
		}
		return Frak_Utils::normalize_host( constant( 'FRAK_MERCHANT_DOMAIN' ) );
	}

	/**
	 * Keys merged into the `window.FrakSetup` config: `env` while dev is
	 * active and `domain` while the override is set. Empty (so the emitted
	 * config is unchanged) when neither applies.
	 *
	 * @return array<string, string>
	 */
	public static function config_overrides(): array {
		$overrides = array();
		if ( self::is_dev() ) {
			$overrides['env'] = 'dev';
		}
		$domain = self::merchant_domain();
		if ( '' !== $domain ) {
			$overrides['domain'] = $domain;
		}
		return $overrides;
	}
}
