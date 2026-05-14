/* global jQuery, wp */
/**
 * Wires the "Upload / select image" buttons emitted by Frak_Widget_Base
 * media fields to the WP media library. Rebinds on `widget-added` /
 * `widget-updated` because WP_Widget rerenders the form fragment after
 * AJAX save and detaches the previous handlers.
 */
( function ( $ ) {
	'use strict';

	if ( typeof wp === 'undefined' || ! wp.media ) {
		return;
	}

	function bind( scope ) {
		scope.find( '.frak-media-picker' ).not( '[data-frak-bound]' ).each( function () {
			var $button = $( this ).attr( 'data-frak-bound', '1' );
			var targetId = $button.data( 'target' );
			if ( ! targetId ) {
				return;
			}

			$button.on( 'click', function ( e ) {
				e.preventDefault();
				var frame = wp.media( {
					title: $button.data( 'title' ) || 'Select image',
					button: { text: $button.data( 'button-text' ) || 'Use this image' },
					library: { type: 'image' },
					multiple: false,
				} );
				frame.on( 'select', function () {
					var attachment = frame.state().get( 'selection' ).first().toJSON();
					if ( ! attachment || ! attachment.url ) {
						return;
					}
					var $input = $( '#' + targetId );
					$input.val( attachment.url ).trigger( 'change' );
					var $preview = $( '#' + targetId + '-preview' );
					$preview.attr( 'src', attachment.url ).show();
					$( '#' + targetId + '-remove' ).show();
				} );
				frame.open();
			} );
		} );

		scope.find( '.frak-media-remove' ).not( '[data-frak-bound]' ).each( function () {
			var $button = $( this ).attr( 'data-frak-bound', '1' );
			var targetId = $button.data( 'target' );
			if ( ! targetId ) {
				return;
			}
			$button.on( 'click', function ( e ) {
				e.preventDefault();
				$( '#' + targetId ).val( '' ).trigger( 'change' );
				$( '#' + targetId + '-preview' ).attr( 'src', '' ).hide();
				$button.hide();
			} );
		} );
	}

	$( function () {
		bind( $( document ) );
		// WP_Widget rerenders the form HTML after every AJAX save, so rebind.
		$( document ).on( 'widget-added widget-updated', function ( _e, widget ) {
			bind( widget );
		} );
	} );
} )( jQuery );
