/* global wp */
( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	const el = element.createElement;
	const { Fragment } = element;
	const { InspectorControls, useBlockProps } = blockEditor;
	const { PanelBody, TextControl, TextareaControl, SelectControl } = components;
	const { __ } = i18n;

	const PREVIEW_MODES = [
		{ label: __( 'Referral success', 'frak' ), value: 'referral' },
		{ label: __( 'In-app browser prompt', 'frak' ), value: 'inapp' },
	];

	blocks.registerBlockType( 'frak/banner', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'frak-block-preview frak-block-preview--banner',
			} );

			const setter = ( key ) => ( value ) => setAttributes( { [ key ]: value } );

			const previewIsInapp = attributes.previewMode === 'inapp';
			const previewTitle = previewIsInapp
				? attributes.inappTitle || __( 'Open in your browser', 'frak' )
				: attributes.referralTitle || __( 'Referral reward', 'frak' );
			const previewDescription = previewIsInapp
				? attributes.inappDescription
				: attributes.referralDescription;
			const previewCta = previewIsInapp
				? attributes.inappCta || __( 'Open browser', 'frak' )
				: attributes.referralCta || __( 'Got it', 'frak' );

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
						el( 'strong', null, previewTitle ),
						previewDescription
							? el( 'p', { style: { margin: '8px 0' } }, previewDescription )
							: null,
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
