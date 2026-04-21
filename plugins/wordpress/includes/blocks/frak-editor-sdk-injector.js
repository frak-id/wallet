/**
 * Shared helper for the Frak Gutenberg blocks.
 *
 * Problem: since Gutenberg 12.8 (WordPress 6.3+), the block canvas renders
 * inside a same-origin iframe. `enqueue_block_editor_assets` registers
 * `frak-sdk` in the **outer** admin window, so `customElements.define()`
 * runs against the outer window's registry. The `<frak-button-share>` /
 * `<frak-banner>` / `<frak-post-purchase>` elements that each block's
 * `edit()` function returns are inserted into the iframe's DOM by React,
 * but the iframe has its own `CustomElementRegistry` — WordPress only
 * forwards `<style>` / `<link>` tags into the iframe, never `<script>`.
 * Result: the elements stay as `HTMLUnknownElement` and never upgrade.
 *
 * Similarly, the SDK reads `window.FrakSetup.config` at bootstrap to decide
 * whether to wait for a backend-resolved merchant config. The inline
 * `window.FrakSetup = {...}` bootstrap injected before `frak-sdk` only
 * populates the outer window; the iframe sees a bare `window`.
 *
 * Fix: from a React effect inside each block's `edit()`, walk up from a
 * rendered DOM ref to the owning window. If that window is the iframe
 * (i.e. NOT the outer admin window), copy `FrakSetup.config` from the
 * outer window into the iframe window, then append the SDK `<script>` to
 * the iframe's `<head>`. The SDK's `loader.js` runs its `discover()`
 * sweep + MutationObserver in whichever window it loads into, so dropping
 * the script into the iframe's document is enough for existing and future
 * `<frak-*>` elements in that iframe to be upgraded.
 *
 * Guarded with `__frakSdkInjected` on the iframe window so a page with
 * three banner blocks doesn't stack three SDK script tags.
 */
/* global window, document */
( function () {
	'use strict';

	if ( typeof window === 'undefined' ) {
		return;
	}
	// Idempotent: multiple editor.js files depend on this helper, but
	// re-registering `__frakEditorInjectSdk` every time the dependency is
	// re-evaluated would wipe the injection flag on hot-reload.
	if ( window.__frakEditorInjectSdk ) {
		return;
	}

	const SDK_SRC = 'https://cdn.jsdelivr.net/npm/@frak-labs/components';

	/**
	 * Ensure the Frak SDK is loaded and `window.FrakSetup` is populated in
	 * the document that owns the given host element.
	 *
	 * @param {Element|null|undefined} hostElement - Any DOM node rendered
	 *   by the block (typically the wrapper `<div>`). Its `ownerDocument`
	 *   is used to reach the correct window.
	 */
	window.__frakEditorInjectSdk = function ( hostElement ) {
		if ( ! hostElement ) {
			return;
		}
		const iframeDoc = hostElement.ownerDocument;
		const iframeWin = iframeDoc && iframeDoc.defaultView;
		if ( ! iframeDoc || ! iframeWin ) {
			return;
		}
		// When the block renders directly into the admin window (classic
		// editor path, or older WP without the iframe canvas), the SDK is
		// already enqueued there by `Frak_Blocks::enqueue_editor_assets()`.
		if ( iframeWin === window ) {
			return;
		}
		if ( iframeWin.__frakSdkInjected ) {
			return;
		}
		iframeWin.__frakSdkInjected = true;

		// Forward the outer-frame bootstrap config. `waitForBackendConfig`
		// is already `false` on the outer window (see
		// `Frak_Blocks::generate_editor_config_script()`), which lets
		// components render immediately on merchant-registered sites even
		// before the full backend handshake completes.
		const outerConfig =
			( window.FrakSetup && window.FrakSetup.config ) || {
				waitForBackendConfig: false,
			};
		iframeWin.FrakSetup = Object.assign( iframeWin.FrakSetup || {}, {
			config: outerConfig,
		} );

		const script = iframeDoc.createElement( 'script' );
		script.src = SDK_SRC;
		script.defer = true;
		iframeDoc.head.appendChild( script );
	};
} )();
