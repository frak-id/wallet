/* global wp */
( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	const el = element.createElement;
	const { Fragment } = element;
	const { InspectorControls, useBlockProps } = blockEditor;
	const { PanelBody, TextControl, TextareaControl, SelectControl } = components;
	const { __ } = i18n;

	const VARIANTS = [
		{ label: __( 'Auto (recommended)', 'frak' ), value: '' },
		{ label: __( 'Referrer (invite to share)', 'frak' ), value: 'referrer' },
		{ label: __( 'Referee (congratulations)', 'frak' ), value: 'referee' },
	];

	const PREVIEW_VARIANTS = [
		{ label: __( 'Referrer (invite to share)', 'frak' ), value: 'referrer' },
		{ label: __( 'Referee (congratulations)', 'frak' ), value: 'referee' },
	];

	function attr( value ) {
		return value !== '' && value !== undefined && value !== null ? String( value ) : undefined;
	}

	blocks.registerBlockType( 'frak/post-purchase', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'frak-block-editor frak-block-editor--post-purchase',
			} );

			const setter = ( key ) => ( value ) => setAttributes( { [ key ]: value } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Copy', 'frak' ), initialOpen: true },
						el( TextControl, {
							label: __( 'Badge text', 'frak' ),
							value: attributes.badgeText,
							onChange: setter( 'badgeText' ),
						} ),
						el( TextareaControl, {
							label: __( 'Referrer message', 'frak' ),
							help: __( 'Shown to buyers who were not referred. Use {REWARD} for the reward amount.', 'frak' ),
							value: attributes.referrerText,
							onChange: setter( 'referrerText' ),
						} ),
						el( TextareaControl, {
							label: __( 'Referee message', 'frak' ),
							help: __( 'Shown to buyers who came from a referral link. Use {REWARD} for the reward amount.', 'frak' ),
							value: attributes.refereeText,
							onChange: setter( 'refereeText' ),
						} ),
						el( TextControl, {
							label: __( 'CTA label', 'frak' ),
							help: __( 'Use {REWARD} to inject the reward amount.', 'frak' ),
							value: attributes.ctaText,
							onChange: setter( 'ctaText' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'Editor preview', 'frak' ), initialOpen: false },
						el( SelectControl, {
							label: __( 'Preview variant', 'frak' ),
							help: __( 'Only affects the editor preview — at runtime the variant is picked from the referral status.', 'frak' ),
							value: attributes.previewVariant,
							options: PREVIEW_VARIANTS,
							onChange: setter( 'previewVariant' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'Behaviour', 'frak' ), initialOpen: false },
						el( SelectControl, {
							label: __( 'Forced variant', 'frak' ),
							value: attributes.variant,
							options: VARIANTS,
							onChange: setter( 'variant' ),
						} ),
						el( TextControl, {
							label: __( 'Sharing URL', 'frak' ),
							help: __( 'Defaults to the merchant domain if left empty.', 'frak' ),
							value: attributes.sharingUrl,
							onChange: setter( 'sharingUrl' ),
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
							label: __( 'Merchant ID override', 'frak' ),
							help: __( 'Leave empty to use the merchant ID from the global config.', 'frak' ),
							value: attributes.merchantId,
							onChange: setter( 'merchantId' ),
						} ),
						el( TextControl, {
							label: __( 'CSS class name', 'frak' ),
							value: attributes.classname,
							onChange: setter( 'classname' ),
						} )
					)
				),
				// Render the real `<frak-post-purchase>` with `preview` so it skips
				// the backend RPC gates (`getUserReferralStatus` / `getMerchantInformation`)
				// that would otherwise keep it hidden in the editor. The re-key on the
				// selected preview variant forces a clean remount when merchants flip
				// between "referrer" and "referee" copy.
				el(
					'div',
					blockProps,
					el( 'frak-post-purchase', {
						key: attributes.previewVariant || 'referrer',
						preview: 'true',
						'preview-variant': attr( attributes.previewVariant ) || 'referrer',
						classname: attr( attributes.classname ),
						placement: attr( attributes.placement ),
						variant: attr( attributes.variant ),
						'merchant-id': attr( attributes.merchantId ),
						'sharing-url': attr( attributes.sharingUrl ),
						'badge-text': attr( attributes.badgeText ),
						'referrer-text': attr( attributes.referrerText ),
						'referee-text': attr( attributes.refereeText ),
						'cta-text': attr( attributes.ctaText ),
					} )
				)
			);
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
