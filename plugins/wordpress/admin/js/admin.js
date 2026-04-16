/* global frak_ajax */
( function () {
	'use strict';

	const ajaxUrl = frak_ajax.ajax_url;
	const nonce = frak_ajax.nonce;
	const siteInfo = frak_ajax.site_info || {};

	/**
	 * Send a POST request to admin-ajax.php.
	 *
	 * @param {string} action WP AJAX action.
	 * @param {Object} [extra] Extra form fields.
	 * @returns {Promise<Object>}
	 */
	async function postAjax( action, extra = {} ) {
		const body = new URLSearchParams( { action, nonce, ...extra } );
		const response = await fetch( ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body,
		} );
		return response.json();
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
	 * Enable or disable the floating-button sub-settings based on the master checkbox.
	 */
	function toggleFloatingButtonSettings() {
		const master = document.getElementById( 'frak_enable_floating_button' );
		if ( ! master ) {
			return;
		}
		const enabled = master.checked;
		[
			'frak_show_reward',
			'frak_button_classname',
			'frak_floating_button_position',
		].forEach( ( id ) => {
			const element = document.getElementById( id );
			if ( element ) {
				element.disabled = ! enabled;
			}
		} );
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
			if ( fileInput ) {
				fileInput.closest( 'td' ).appendChild( preview );
			}
		}
		preview.querySelector( 'img' ).src = src;
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
	 * Open the Frak business dashboard webhook setup flow in a popup.
	 *
	 * @param {Event} event
	 */
	function handleOpenWebhookPopup( event ) {
		event.preventDefault();
		const productId = event.currentTarget.dataset.productId;
		const secretInput = document.getElementById( 'frak_webhook_secret' );
		const secret = secretInput ? secretInput.value : '';

		if ( ! secret ) {
			window.alert( 'Please generate a webhook secret first' );
			return;
		}

		const createUrl = new URL( 'https://business.frak.id' );
		createUrl.pathname = '/embedded/purchase-tracker';
		createUrl.searchParams.append( 'pid', productId );
		createUrl.searchParams.append( 's', secret );
		createUrl.searchParams.append( 'p', 'custom' );

		const popup = window.open(
			createUrl.href,
			'frak-business',
			'menubar=no,status=no,scrollbars=no,fullscreen=no,width=500,height=800'
		);
		if ( ! popup ) {
			return;
		}
		popup.focus();

		const timer = setInterval( () => {
			if ( popup.closed ) {
				clearInterval( timer );
				setTimeout( checkWebhookStatus, 1000 );
			}
		}, 500 );
	}

	/**
	 * Fetch the current webhook status and update the UI badge.
	 */
	async function checkWebhookStatus() {
		const response = await postAjax( 'frak_check_webhook_status' );
		if ( ! response.success ) {
			return;
		}
		const badge = document.querySelector( '.frak-webhook-status' );
		if ( ! badge ) {
			return;
		}
		if ( response.data.status ) {
			badge.classList.remove( 'status-inactive' );
			badge.classList.add( 'status-active' );
			badge.textContent = 'Active';
			showNotice( 'Webhook is now active!', 'success' );
		} else {
			badge.classList.remove( 'status-active' );
			badge.classList.add( 'status-inactive' );
			badge.textContent = 'Inactive';
		}
	}

	/**
	 * Regenerate the webhook secret (confirm first).
	 *
	 * @param {Event} event
	 */
	async function handleGenerateSecret( event ) {
		event.preventDefault();
		if (
			! window.confirm(
				'Are you sure you want to regenerate the webhook secret? This will break the integration if you have already configured it on Frak.'
			)
		) {
			return;
		}
		const response = await postAjax( 'frak_generate_webhook_secret' );
		if ( response.success ) {
			const input = document.getElementById( 'frak_webhook_secret' );
			if ( input ) {
				input.value = response.data.secret;
			}
			showNotice( response.data.message, 'success' );
		} else {
			showNotice( 'Error generating webhook secret', 'error' );
		}
	}

	/**
	 * Trigger a webhook test and surface the outcome.
	 *
	 * @param {Event} event
	 */
	async function handleTestWebhook( event ) {
		event.preventDefault();
		const button = event.currentTarget;
		button.disabled = true;
		button.textContent = 'Testing...';

		const response = await postAjax( 'frak_test_webhook' );
		if ( response.success ) {
			showNotice( response.data.message, 'success' );
		} else {
			showNotice( response.data.message, 'error' );
		}

		button.disabled = false;
		button.textContent = 'Test Webhook';
	}

	/**
	 * Clear stored webhook logs (confirm first, then reload page).
	 *
	 * @param {Event} event
	 */
	async function handleClearLogs( event ) {
		event.preventDefault();
		if ( ! window.confirm( 'Are you sure you want to clear all webhook logs?' ) ) {
			return;
		}
		const response = await postAjax( 'frak_clear_webhook_logs' );
		if ( response.success ) {
			showNotice( response.data.message, 'success' );
			setTimeout( () => window.location.reload(), 1000 );
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

		const floatingMaster = document.getElementById( 'frak_enable_floating_button' );
		if ( floatingMaster ) {
			floatingMaster.addEventListener( 'change', toggleFloatingButtonSettings );
			toggleFloatingButtonSettings();
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

		const generateBtn = document.getElementById( 'generate-webhook-secret' );
		if ( generateBtn ) {
			generateBtn.addEventListener( 'click', handleGenerateSecret );
		}

		const testBtn = document.getElementById( 'test-webhook' );
		if ( testBtn ) {
			testBtn.addEventListener( 'click', handleTestWebhook );
		}

		const clearBtn = document.getElementById( 'clear-webhook-logs' );
		if ( clearBtn ) {
			clearBtn.addEventListener( 'click', handleClearLogs );
		}

		const popupBtn = document.getElementById( 'open-webhook-popup' );
		if ( popupBtn ) {
			popupBtn.addEventListener( 'click', handleOpenWebhookPopup );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
