/* global wp */
( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	const el = element.createElement;
	const { Fragment, useEffect, useRef } = element;
	const { InspectorControls, useBlockProps } = blockEditor;
	const { PanelBody, TextControl, TextareaControl, SelectControl } = components;
	const { __ } = i18n;

	const PREVIEW_MODES = [
		{ label: __( 'Referral success', 'frak' ), value: 'referral' },
		{ label: __( 'In-app browser prompt', 'frak' ), value: 'inapp' },
	];

	// Drop empty strings so `<frak-banner>` only sees attributes the merchant
	// actually set — the web component already has sensible defaults for the rest.
	// Return null (not undefined) so React 18 calls `removeAttribute()` on the
	// custom element. Passing `undefined` leaves stale attrs stuck in the DOM.
	function attr( value ) {
		return value !== '' && value !== undefined && value !== null ? String( value ) : null;
	}

	blocks.registerBlockType( 'frak/banner', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const hostRef = useRef( null );
			const blockProps = useBlockProps( {
				className: 'frak-block-editor frak-block-editor--banner',
			} );

			// Gutenberg renders the block canvas in a same-origin iframe, but WP
			// only forwards styles — not scripts — so the SDK enqueued against
			// the outer window never defines custom elements in the iframe's
			// registry. Re-inject from the owning document once the wrapper is
			// mounted; the helper no-ops when we're already in the outer window.
			useEffect( () => {
				if ( typeof window !== 'undefined' && typeof window.__frakEditorInjectSdk === 'function' ) {
					window.__frakEditorInjectSdk( hostRef.current );
				}
			}, [] );

			const setter = ( key ) => ( value ) => setAttributes( { [ key ]: value } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Referral mode', 'frak' ), initialOpen: true },
						el( TextControl, {
							label: __( 'Title', 'frak' ),
							value: attributes.referralTitle,
							onChange: setter( 'referralTitle' ),
						} ),
						el( TextareaControl, {
							label: __( 'Description', 'frak' ),
							value: attributes.referralDescription,
							onChange: setter( 'referralDescription' ),
						} ),
						el( TextControl, {
							label: __( 'CTA label', 'frak' ),
							value: attributes.referralCta,
							onChange: setter( 'referralCta' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'In-app browser mode', 'frak' ), initialOpen: false },
						el( TextControl, {
							label: __( 'Title', 'frak' ),
							value: attributes.inappTitle,
							onChange: setter( 'inappTitle' ),
						} ),
						el( TextareaControl, {
							label: __( 'Description', 'frak' ),
							value: attributes.inappDescription,
							onChange: setter( 'inappDescription' ),
						} ),
						el( TextControl, {
							label: __( 'CTA label', 'frak' ),
							value: attributes.inappCta,
							onChange: setter( 'inappCta' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'Editor preview', 'frak' ), initialOpen: false },
						el( SelectControl, {
							label: __( 'Preview mode', 'frak' ),
							value: attributes.previewMode,
							options: PREVIEW_MODES,
							onChange: setter( 'previewMode' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'Advanced', 'frak' ), initialOpen: false },
						el( TextControl, {
							label: __( 'Placement ID', 'frak' ),
							value: attributes.placement,
							onChange: setter( 'placement' ),
						} ),
						el( TextControl, {
							label: __( 'Interaction filter', 'frak' ),
							help: __( 'e.g. "purchase" to limit rewards to a specific interaction.', 'frak' ),
							value: attributes.interaction,
							onChange: setter( 'interaction' ),
						} ),
						el( TextControl, {
							label: __( 'CSS class name', 'frak' ),
							value: attributes.classname,
							onChange: setter( 'classname' ),
						} )
					)
				),
				// Render the real `<frak-banner>` web component with `preview` so it
				// short-circuits the in-app / referral-event detection and renders
				// immediately in the editor iframe. We re-key on `previewMode` so the
				// element remounts cleanly when merchants toggle the preview variant.
				el(
					'div',
					{ ...blockProps, ref: hostRef },
					el( 'frak-banner', {
						key: attributes.previewMode || 'referral',
						preview: 'true',
						'preview-mode': attr( attributes.previewMode ) || 'referral',
						placement: attr( attributes.placement ),
						classname: attr( attributes.classname ),
						interaction: attr( attributes.interaction ),
						'referral-title': attr( attributes.referralTitle ),
						'referral-description': attr( attributes.referralDescription ),
						'referral-cta': attr( attributes.referralCta ),
						'inapp-title': attr( attributes.inappTitle ),
						'inapp-description': attr( attributes.inappDescription ),
						'inapp-cta': attr( attributes.inappCta ),
					} )
				)
			);
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
