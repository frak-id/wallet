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

	/** JsDelivr host, used by the fallback and its own preconnect. */
	public const JSDELIVR_HOST = 'https://cdn.jsdelivr.net';

	/**
	 * First-party pointer host, ~5 min TTL, re-flipped on every SDK release.
	 * Follows {@see Frak_Env}.
	 *
	 * @return string
	 */
	public static function pointer_host(): string {
		return Frak_Env::sdk_host();
	}

	/**
	 * The one-line shim served at {@see pointer_host()}.
	 *
	 * @return string
	 */
	public static function pointer_script(): string {
		return self::pointer_host() . '/components.js';
	}

	/**
	 * Fallback shim loaded only if {@see pointer_script()} fails: `@latest` in
	 * production, `@beta` on the dev stack.
	 *
	 * @return string
	 */
	public static function fallback_script(): string {
		return self::JSDELIVR_HOST . '/npm/@frak-labs/components@' . Frak_Env::jsdelivr_tag() . '/cdn/components.js';
	}

	/**
	 * `onerror` body for the pointer `<script>`: the pointer file is a single
	 * `import()` statement, so a failed load executed nothing and the jsDelivr
	 * shim can be loaded in its place without double-evaluating anything.
	 *
	 * @return string
	 */
	public static function fallback_onerror_js(): string {
		return "var s=document.createElement('script');s.src='" . self::fallback_script() . "';s.defer=true;document.head.appendChild(s)";
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
				'pointer'  => self::pointer_script(),
				'fallback' => self::fallback_script(),
			)
		) . ';';
	}
}
