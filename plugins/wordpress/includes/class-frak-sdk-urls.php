<?php
/**
 * Single source of truth for the SDK script hosts so the enqueued/injected
 * `<script>` tags, the `onerror` fallback and the resource hints all agree.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Sdk_Urls
 */
class Frak_Sdk_Urls {

	/** First-party pointer, ~5 min TTL, re-flipped on every SDK release. */
	public const POINTER_HOST = 'https://sdk.frak.id';

	/** The one-line shim served at {@see POINTER_HOST}. */
	public const POINTER_SCRIPT = self::POINTER_HOST . '/components.js';

	/** JsDelivr host, used by the fallback and its own preconnect. */
	public const JSDELIVR_HOST = 'https://cdn.jsdelivr.net';

	/** Fallback shim loaded only if {@see POINTER_SCRIPT} fails. */
	public const FALLBACK_SCRIPT = self::JSDELIVR_HOST . '/npm/@frak-labs/components@latest/cdn/components.js';

	/**
	 * `onerror` body for the pointer `<script>`: the pointer file is a single
	 * `import()` statement, so a failed load executed nothing and the jsDelivr
	 * shim can be loaded in its place without double-evaluating anything.
	 *
	 * @return string
	 */
	public static function fallback_onerror_js(): string {
		return "var s=document.createElement('script');s.src='" . self::FALLBACK_SCRIPT . "';s.defer=true;document.head.appendChild(s)";
	}

	/**
	 * `script_loader_tag` callback adding the fallback `onerror` to the
	 * `frak-sdk` tag. `$tag` also carries the inline `before` config script,
	 * so only the opening tag that has a `src` is touched.
	 *
	 * @param string $tag    Full `<script>` tag markup.
	 * @param string $handle Registered script handle.
	 * @return string
	 */
	public static function add_onerror_attribute( $tag, $handle ) {
		if ( 'frak-sdk' !== $handle ) {
			return $tag;
		}
		$with_onerror = '<script onerror="' . esc_attr( self::fallback_onerror_js() ) . '" ';
		return preg_replace( '/<script (?=[^>]*\bsrc=)/', $with_onerror, $tag, 1 );
	}

	/**
	 * Inline script exposing the pointer and fallback URLs to
	 * `frak-editor-sdk-injector.js`, which injects the SDK into the Gutenberg
	 * canvas iframe with a `createElement` path of its own.
	 *
	 * @return string
	 */
	public static function injector_urls_script(): string {
		return 'window.__frakSdkUrls=' . wp_json_encode(
			array(
				'pointer'  => self::POINTER_SCRIPT,
				'fallback' => self::FALLBACK_SCRIPT,
			)
		) . ';';
	}
}
