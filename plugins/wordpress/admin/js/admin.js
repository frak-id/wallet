/* global jQuery, frak_ajax */
jQuery( document ).ready( function( $ ) {
	// Toggle floating button settings.
	function toggleFloatingButtonSettings() {
		var enabled = $( '#frak_enable_floating_button' ).is( ':checked' );
		$( '#frak_show_reward, #frak_button_classname, #frak_floating_button_position' ).prop( 'disabled', ! enabled );
	}

	// Logo file preview.
	function handleLogoFileSelect( e ) {
		var file = e.target.files[0];
		if ( file && file.type.match( 'image.*' ) ) {
			var reader = new FileReader();
			reader.onload = function( ev ) {
				updateLogoPreview( ev.target.result );
				$( '#frak_logo_url' ).val( '' ).attr( 'placeholder', 'File selected: ' + file.name );
			};
			reader.readAsDataURL( file );
		}
	}

	// Update logo preview.
	function updateLogoPreview( src ) {
		var $preview = $( '.frak-logo-preview' );
		if ( 0 === $preview.length ) {
			$preview = $( '<div class="frak-logo-preview" style="margin-top: 10px;"><img alt="Logo preview" style="max-height: 80px; max-width: 200px;"></div>' );
			$( '#frak_logo_file' ).closest( 'td' ).append( $preview );
		}
		$preview.find( 'img' ).attr( 'src', src );
	}

	// Handle logo URL changes.
	function handleLogoUrlChange() {
		var url = $( this ).val();
		if ( url ) {
			updateLogoPreview( url );
			$( '#frak_logo_file' ).val( '' );
		}
	}

	// Autofill functionality.
	$( '#autofill_app_name' ).on( 'click', function() {
		if ( frak_ajax.site_info.name ) {
			$( '#frak_app_name' ).val( frak_ajax.site_info.name ).trigger( 'input' );
		}
	} );

	$( '#autofill_logo_url' ).on( 'click', function() {
		if ( frak_ajax.site_info.logo_url ) {
			$( '#frak_logo_url' ).val( frak_ajax.site_info.logo_url ).trigger( 'input' );
		}
	} );

	// Bind events.
	$( '#frak_enable_floating_button' ).on( 'change', toggleFloatingButtonSettings );
	$( '#frak_logo_file' ).on( 'change', handleLogoFileSelect );
	$( '#frak_logo_url' ).on( 'input', handleLogoUrlChange );

	// Initialize toggles.
	toggleFloatingButtonSettings();

	// Generate webhook secret.
	$( '#generate-webhook-secret' ).on( 'click', function( e ) {
		e.preventDefault();

		if ( ! window.confirm( 'Are you sure you want to regenerate the webhook secret? This will break the integration if you have already configured it on Frak.' ) ) {
			return;
		}

		$.post( frak_ajax.ajax_url, {
			action: 'frak_generate_webhook_secret',
			nonce: frak_ajax.nonce,
		}, function( response ) {
			if ( response.success ) {
				$( '#frak_webhook_secret' ).val( response.data.secret );
				showNotice( response.data.message, 'success' );
			} else {
				showNotice( 'Error generating webhook secret', 'error' );
			}
		} );
	} );

	// Test webhook.
	$( '#test-webhook' ).on( 'click', function( e ) {
		e.preventDefault();

		var $button = $( this );
		$button.prop( 'disabled', true ).text( 'Testing...' );

		$.post( frak_ajax.ajax_url, {
			action: 'frak_test_webhook',
			nonce: frak_ajax.nonce,
		}, function( response ) {
			if ( response.success ) {
				showNotice( response.data.message, 'success' );
			} else {
				showNotice( response.data.message, 'error' );
			}
		} ).always( function() {
			$button.prop( 'disabled', false ).text( 'Test Webhook' );
		} );
	} );

	// Clear webhook logs.
	$( '#clear-webhook-logs' ).on( 'click', function( e ) {
		e.preventDefault();

		if ( ! window.confirm( 'Are you sure you want to clear all webhook logs?' ) ) {
			return;
		}

		$.post( frak_ajax.ajax_url, {
			action: 'frak_clear_webhook_logs',
			nonce: frak_ajax.nonce,
		}, function( response ) {
			if ( response.success ) {
				showNotice( response.data.message, 'success' );
				setTimeout( function() {
					window.location.reload();
				}, 1000 );
			}
		} );
	} );

	// Open webhook setup popup.
	$( '#open-webhook-popup' ).on( 'click', function( e ) {
		e.preventDefault();

		var productId = $( this ).data( 'product-id' );
		var webhookSecret = $( '#frak_webhook_secret' ).val();

		if ( ! webhookSecret ) {
			window.alert( 'Please generate a webhook secret first' );
			return;
		}

		var createUrl = new URL( 'https://business.frak.id' );
		createUrl.pathname = '/embedded/purchase-tracker';
		createUrl.searchParams.append( 'pid', productId );
		createUrl.searchParams.append( 's', webhookSecret );
		createUrl.searchParams.append( 'p', 'custom' );

		var openedWindow = window.open(
			createUrl.href,
			'frak-business',
			'menubar=no,status=no,scrollbars=no,fullscreen=no,width=500,height=800'
		);

		if ( openedWindow ) {
			openedWindow.focus();

			var timer = setInterval( function() {
				if ( openedWindow.closed ) {
					clearInterval( timer );
					setTimeout( function() {
						checkWebhookStatus();
					}, 1000 );
				}
			}, 500 );
		}
	} );

	// Check webhook status.
	function checkWebhookStatus() {
		$.post( frak_ajax.ajax_url, {
			action: 'frak_check_webhook_status',
			nonce: frak_ajax.nonce,
		}, function( response ) {
			if ( response.success ) {
				var $status = $( '.frak-webhook-status' );
				if ( response.data.status ) {
					$status.removeClass( 'status-inactive' ).addClass( 'status-active' ).text( 'Active' );
					showNotice( 'Webhook is now active!', 'success' );
				} else {
					$status.removeClass( 'status-active' ).addClass( 'status-inactive' ).text( 'Inactive' );
				}
			}
		} );
	}

	// Show admin notice.
	function showNotice( message, type ) {
		var $notice = $( '<div class="notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>' );
		$( '.wrap h1' ).after( $notice );

		setTimeout( function() {
			$notice.fadeOut( function() {
				$( this ).remove();
			} );
		}, 5000 );
	}

	// Initialize logo preview if logo URL exists.
	var existingLogoUrl = $( '#frak_logo_url' ).val();
	if ( existingLogoUrl ) {
		updateLogoPreview( existingLogoUrl );
	}
} );
