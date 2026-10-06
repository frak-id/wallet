<?php
/**
 * Shared utility helpers.
 *
 * Small pure functions that more than one class needs. Kept as static
 * methods rather than namespaced functions so the classmap autoloader
 * (see `composer.json`) picks them up without extra wiring.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Utils
 */
class Frak_Utils {

	/**
	 * Return the domain the site acts as: the `FRAK_MERCHANT_DOMAIN` override
	 * when set (see {@see Frak_Env::merchant_domain()}), else the real
	 * {@see site_host()}.
	 *
	 * Shared by {@see Frak_Merchant} (cache key) and
	 * {@see Frak_WC_Webhook_Registrar} (domain-drift detection).
	 *
	 * @return string Empty string when the host cannot be determined.
	 */
	public static function current_host(): string {
		$override = Frak_Env::merchant_domain();
		return '' !== $override ? $override : self::site_host();
	}

	/**
	 * Return the `home_url()` host, normalised by {@see normalize_host()}.
	 *
	 * @return string Empty string when the host cannot be determined.
	 */
	public static function site_host(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		return is_string( $host ) ? self::normalize_host( $host ) : '';
	}

	/**
	 * Lower-case a host and strip a leading `www.` so comparisons align with
	 * the backend's normalization (see `MerchantRepository::getNormalizedDomain`).
	 *
	 * @param string $host Raw host.
	 * @return string
	 */
	public static function normalize_host( string $host ): string {
		$host = strtolower( trim( $host ) );
		if ( 0 === strpos( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}
		return $host;
	}

	/**
	 * Resolve the site's brand image URL, preferring the site icon over the
	 * Customizer custom logo. Returns an empty string when neither is set.
	 *
	 * Shared by {@see Frak_Admin} (form defaults + localized site_info
	 * payload) so the "Use Site Icon" affordance and the stored-value
	 * fallback render the same URL.
	 *
	 * @return string
	 */
	public static function site_icon_url(): string {
		$site_icon_id = get_option( 'site_icon' );
		if ( $site_icon_id ) {
			$site_icon_url = wp_get_attachment_image_url( (int) $site_icon_id, 'full' );
			if ( $site_icon_url ) {
				return (string) $site_icon_url;
			}
		}

		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id ) {
			$custom_logo_url = wp_get_attachment_image_url( (int) $custom_logo_id, 'full' );
			if ( $custom_logo_url ) {
				return (string) $custom_logo_url;
			}
		}

		return '';
	}
}
