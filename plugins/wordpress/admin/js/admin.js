/* global frak_ajax */
( function () {
	'use strict';

	if ( typeof frak_ajax === 'undefined' ) {
		return;
	}

	const ajaxUrl = frak_ajax.ajax_url;
	const nonce = frak_ajax.nonce;
	const siteInfo = frak_ajax.site_info || {};

	/**
	 * POST to admin-ajax.php and coerce any failure mode (network, non-2xx,
	 * non-JSON body, fatal PHP output, nonce "0" response) into a uniform
	 * `{ success, data: { message } }` envelope. Matches what WP’s
	 * `wp_send_json_success`/`wp_send_json_error` return on the happy path,
	 * so callers never have to special-case silent failures.
	 *
	 * @param {string} action WP AJAX action.
	 * @param {Object} [extra] Extra form fields.
	 * @returns {Promise<{success: boolean, data: {message?: string}}>}
	 */
	async function postAjax( action, extra = {} ) {
		const body = new URLSearchParams( { action, nonce, ...extra } );
		let response;
		try {
			response = await fetch( ajaxUrl, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			} );
		} catch ( networkError ) {
			return {
				success: false,
				data: { message: `Network error: ${ networkError.message || networkError }` },
			};
		}

		const text = await response.text();
		if ( ! response.ok ) {
			return {
				success: false,
				data: { message: `HTTP ${ response.status }: ${ text.slice( 0, 240 ) || response.statusText }` },
			};
		}
		// `admin-ajax.php` returns the literal string "0" when the requested
		// action has no registered handler and "-1" on a nonce failure; catch
		// both before the JSON parse.
		if ( '0' === text || '-1' === text ) {
			return {
				success: false,
				data: { message: '-1' === text ? 'Session expired, please reload.' : 'Unknown AJAX action.' },
			};
		}
		try {
			return JSON.parse( text );
		} catch ( parseError ) {
			return {
				success: false,
				data: { message: `Unexpected response: ${ text.slice( 0, 240 ) }` },
			};
		}
	}

	/**
	 * Show a dismissible WP admin notice.
	 *
	 * @param {string} message
	 * @param {'success'|'error'|'warning'|'info'} type
	 */
	function showNotice( message, type ) {
		const notice = document.createElement( 'div' );
		notice.className = `notice notice-${ type } is-dismissible`;
		const paragraph = document.createElement( 'p' );
		paragraph.textContent = message;
		notice.appendChild( paragraph );

		const heading = document.querySelector( '.wrap h1' );
		if ( heading ) {
			heading.insertAdjacentElement( 'afterend', notice );
		}

		setTimeout( () => {
			notice.style.transition = 'opacity 0.3s';
			notice.style.opacity = '0';
			setTimeout( () => notice.remove(), 300 );
		}, 5000 );
	}


	/**
	 * Render a logo preview inside the file-input's cell.
	 *
	 * @param {string} src
	 */
	function updateLogoPreview( src ) {
		let preview = document.querySelector( '.frak-logo-preview' );
		if ( ! preview ) {
			preview = document.createElement( 'div' );
			preview.className = 'frak-logo-preview';
			preview.style.marginTop = '10px';
			const image = document.createElement( 'img' );
			image.alt = 'Logo preview';
			image.style.maxHeight = '80px';
			image.style.maxWidth = '200px';
			preview.appendChild( image );

			const fileInput = document.getElementById( 'frak_logo_file' );
			const fileInputCell = fileInput ? fileInput.closest( 'td' ) : null;
			if ( ! fileInputCell ) {
				return;
			}
			fileInputCell.appendChild( preview );
		}
		const previewImage = preview.querySelector( 'img' );
		if ( previewImage ) {
			previewImage.src = src;
		}
	}

	/**
	 * Handle logo file selection — show preview from FileReader data URL.
	 *
	 * @param {Event} event
	 */
	function handleLogoFileSelect( event ) {
		const file = event.target.files[ 0 ];
		if ( ! file || ! file.type.startsWith( 'image/' ) ) {
			return;
		}
		const reader = new FileReader();
		reader.onload = ( readerEvent ) => {
			updateLogoPreview( readerEvent.target.result );
			const urlInput = document.getElementById( 'frak_logo_url' );
			if ( urlInput ) {
				urlInput.value = '';
				urlInput.placeholder = `File selected: ${ file.name }`;
			}
		};
		reader.readAsDataURL( file );
	}

	/**
	 * Handle logo URL input — preview remote image and clear file input.
	 *
	 * @param {Event} event
	 */
	function handleLogoUrlChange( event ) {
		const url = event.target.value;
		if ( ! url ) {
			return;
		}
		updateLogoPreview( url );
		const fileInput = document.getElementById( 'frak_logo_file' );
		if ( fileInput ) {
			fileInput.value = '';
		}
	}

	/**
	 * Refresh the cached merchant for the current site and reload the page so
	 * the admin view picks up the new state (resolved / still unresolved /
	 * different name). Wired to the "Refresh Merchant" button — used to recover
	 * from delete-and-recreate, domain change, or the 5-min negative cache.
	 *
	 * @param {Event} event
	 */
	async function handleRefreshMerchant( event ) {
		event.preventDefault();
		const button = event.currentTarget;
		button.disabled = true;
		button.textContent = 'Refreshing...';

		const response = await postAjax( 'frak_refresh_merchant' );
		const message = response.data?.message || ( response.success ? 'Merchant refreshed' : 'Failed to refresh merchant' );
		if ( response.success ) {
			showNotice( message, 'success' );
			setTimeout( () => window.location.reload(), 800 );
		} else {
			showNotice( message, 'error' );
			button.disabled = false;
			button.textContent = 'Refresh Merchant';
		}
	}

	/**
	 * Create / refresh the Frak-owned WooCommerce webhook. Wired to the
	 * "Set up / Re-enable / Sync" button on the settings page so operators can
	 * recover from a manually-disabled webhook, a stale URL (domain change,
	 * merchant re-register) or a missing row without editing WC's advanced
	 * settings directly.
	 *
	 * @param {Event} event
	 */
	async function handleSetupWcWebhook( event ) {
		event.preventDefault();
		const button = event.currentTarget;
		const originalLabel = button.textContent;
		button.disabled = true;
		button.textContent = 'Working...';

		const response = await postAjax( 'frak_setup_wc_webhook' );
		const message = response.data?.message || ( response.success ? 'Webhook synced' : 'Failed to sync webhook' );
		if ( response.success ) {
			showNotice( message, 'success' );
			setTimeout( () => window.location.reload(), 800 );
		} else {
			showNotice( message, 'error' );
			button.disabled = false;
			button.textContent = originalLabel;
		}
	}

	/**
	 * Wire up all event listeners once the DOM is ready.
	 */
	function init() {
		const appNameButton = document.getElementById( 'autofill_app_name' );
		if ( appNameButton && siteInfo.name ) {
			appNameButton.addEventListener( 'click', () => {
				const input = document.getElementById( 'frak_app_name' );
				if ( input ) {
					input.value = siteInfo.name;
					input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				}
			} );
		}

		const logoButton = document.getElementById( 'autofill_logo_url' );
		if ( logoButton && siteInfo.logo_url ) {
			logoButton.addEventListener( 'click', () => {
				const input = document.getElementById( 'frak_logo_url' );
				if ( input ) {
					input.value = siteInfo.logo_url;
					input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				}
			} );
		}


		const logoFile = document.getElementById( 'frak_logo_file' );
		if ( logoFile ) {
			logoFile.addEventListener( 'change', handleLogoFileSelect );
		}

		const logoUrl = document.getElementById( 'frak_logo_url' );
		if ( logoUrl ) {
			logoUrl.addEventListener( 'input', handleLogoUrlChange );
			if ( logoUrl.value ) {
				updateLogoPreview( logoUrl.value );
			}
		}

		const refreshMerchantBtn = document.getElementById( 'refresh-merchant' );
		if ( refreshMerchantBtn ) {
			refreshMerchantBtn.addEventListener( 'click', handleRefreshMerchant );
		}

		const setupWcBtn = document.getElementById( 'setup-wc-webhook' );
		if ( setupWcBtn ) {
			setupWcBtn.addEventListener( 'click', handleSetupWcWebhook );
		}
	}

	function safeInit() {
		try {
			init();
		} catch ( initError ) {
			// Surface silently-swallowed init errors (missing DOM node, runtime
			// exception in one of the listeners) so the admin can at least see
			// why the page’s buttons aren’t wired.
			if ( window.console && window.console.error ) {
				window.console.error( 'Frak admin init failed:', initError );
			}
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', safeInit );
	} else {
		safeInit();
	}
} )();
