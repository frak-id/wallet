/* global wp */
( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	const el = element.createElement;
	const { Fragment } = element;
	const { InspectorControls, useBlockProps } = blockEditor;
	const { PanelBody, TextControl, ToggleControl, SelectControl } = components;
	const { __ } = i18n;

	const CLICK_ACTIONS = [
		{ label: __( 'Embedded wallet', 'frak' ), value: 'embedded-wallet' },
		{ label: __( 'Share modal', 'frak' ), value: 'share-modal' },
		{ label: __( 'Sharing page', 'frak' ), value: 'sharing-page' },
	];

	blocks.registerBlockType( 'frak/share-button', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'frak-block-preview frak-block-preview--share-button',
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
						{ title: __( 'Button', 'frak' ), initialOpen: true },
						el( TextControl, {
							label: __( 'Button text', 'frak' ),
							help: __( 'Use {REWARD} to inject the reward amount at runtime.', 'frak' ),
							value: attributes.text,
							onChange: setter( 'text' ),
						} ),
						el( ToggleControl, {
							label: __( 'Show potential reward', 'frak' ),
							help: __( 'Fetches and displays the reward value on the button.', 'frak' ),
							checked: attributes.useReward,
							onChange: setter( 'useReward' ),
						} ),
						attributes.useReward &&
							el( TextControl, {
								label: __( 'Fallback text (no reward)', 'frak' ),
								value: attributes.noRewardText,
								onChange: setter( 'noRewardText' ),
							} ),
						el( SelectControl, {
							label: __( 'Click action', 'frak' ),
							value: attributes.clickAction,
							options: CLICK_ACTIONS,
							onChange: setter( 'clickAction' ),
						} )
					),
					el(
						PanelBody,
						{ title: __( 'Advanced', 'frak' ), initialOpen: false },
						el( TextControl, {
							label: __( 'Placement ID', 'frak' ),
							help: __( 'Backend placement identifier for custom configuration.', 'frak' ),
							value: attributes.placement,
							onChange: setter( 'placement' ),
						} ),
						el( TextControl, {
							label: __( 'Target interaction', 'frak' ),
							value: attributes.targetInteraction,
							onChange: setter( 'targetInteraction' ),
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
						'button',
						{
							type: 'button',
							className: 'wp-block-button__link',
							disabled: true,
							style: { pointerEvents: 'none' },
						},
						attributes.text || __( 'Share and earn!', 'frak' )
					)
				)
			);
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
