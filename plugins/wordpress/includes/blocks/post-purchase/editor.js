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

	blocks.registerBlockType( 'frak/post-purchase', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'frak-block-preview frak-block-preview--post-purchase',
			} );

			const setter = ( key ) => ( value ) => setAttributes( { [ key ]: value } );

			const previewBadge = attributes.badgeText || __( 'Limited offer', 'frak' );
			const previewMessage =
				attributes.referrerText ||
				attributes.refereeText ||
				__( 'Share this purchase and earn {REWARD}.', 'frak' );
			const previewCta = attributes.ctaText || __( 'Share & earn', 'frak' );

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
				el(
					'div',
					blockProps,
					el(
						'div',
						{
							style: {
								border: '1px dashed #cbd2d9',
								borderRadius: '8px',
								padding: '16px',
								background: '#f8fafb',
							},
						},
						el(
							'span',
							{
								style: {
									display: 'inline-block',
									padding: '2px 8px',
									borderRadius: '999px',
									background: '#2271b1',
									color: '#fff',
									fontSize: '12px',
									marginBottom: '8px',
								},
							},
							previewBadge
						),
						el( 'p', { style: { margin: '8px 0' } }, previewMessage ),
						el(
							'button',
							{
								type: 'button',
								className: 'wp-block-button__link',
								disabled: true,
								style: { pointerEvents: 'none' },
							},
							previewCta
						)
					)
				)
			);
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
