/* global wp */
( function ( blocks, element, blockEditor, components, i18n ) {
	'use strict';

	const el = element.createElement;
	const { Fragment, useEffect, useRef } = element;
	const { InspectorControls, useBlockProps } = blockEditor;
	const { PanelBody, TextControl, ToggleControl, SelectControl } = components;
	const { __ } = i18n;

	const CLICK_ACTIONS = [
		{ label: __( 'Sharing page', 'frak' ), value: 'sharing-page' },
		{ label: __( 'Share modal', 'frak' ), value: 'share-modal' },
		{ label: __( 'Embedded wallet', 'frak' ), value: 'embedded-wallet' },
	];

	const BUTTON_STYLES = [
		{ label: __( 'Primary (theme button)', 'frak' ), value: 'primary' },
		{ label: __( 'Secondary (outline)', 'frak' ), value: 'secondary' },
		{ label: __( 'None (custom class only)', 'frak' ), value: 'none' },
	];

	const BUTTON_STYLE_CLASSES = {
		primary: 'wp-element-button wp-block-button__link',
		secondary: 'wp-element-button wp-block-button__link is-style-outline',
		none: '',
	};

	function composeClassname( buttonStyle, classname ) {
		const preset = BUTTON_STYLE_CLASSES[ buttonStyle ] || '';
		return [ preset, classname ].filter( Boolean ).join( ' ' ).trim();
	}

	// Return null (not undefined) for missing values so React 18 calls
	// `removeAttribute()` on custom elements. Passing `undefined` leaves the
	// attribute stuck in the DOM across re-renders, which corrupts the web
	// component's state (presence of `use-reward` is treated as truthy even
	// when the toggle is off).
	function attr( value ) {
		return value !== '' && value !== undefined && value !== null ? String( value ) : null;
	}

	blocks.registerBlockType( 'frak/share-button', {
		edit( props ) {
			const { attributes, setAttributes } = props;
			const hostRef = useRef( null );
			const blockProps = useBlockProps( {
				className: 'frak-block-editor frak-block-editor--share-button',
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
						{ title: __( 'Button', 'frak' ), initialOpen: true },
						el( TextControl, {
							label: __( 'Button text', 'frak' ),
							help: __( 'Use {REWARD} to inject the reward amount at runtime.', 'frak' ),
							value: attributes.text,
							onChange: setter( 'text' ),
						} ),
						el( SelectControl, {
							label: __( 'Button style', 'frak' ),
							help: __( 'Applies WordPress button classes so the button inherits your theme styling.', 'frak' ),
							value: attributes.buttonStyle,
							options: BUTTON_STYLES,
							onChange: setter( 'buttonStyle' ),
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
							} )
					),
					el(
						PanelBody,
						{ title: __( 'Advanced', 'frak' ), initialOpen: false },
						el( SelectControl, {
							label: __( 'Click action', 'frak' ),
							help: __( 'Override what happens when the button is clicked.', 'frak' ),
							value: attributes.clickAction,
							options: CLICK_ACTIONS,
							onChange: setter( 'clickAction' ),
						} ),
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
							help: __( 'Additional classes appended after the button-style preset.', 'frak' ),
							value: attributes.classname,
							onChange: setter( 'classname' ),
						} )
					)
				),
				// Render the real `<frak-button-share>` with `preview` so it bypasses
				// the `isClientReady` gate (no SDK client exists in the editor) and
				// stays interactive-looking while the click handler is no-op'd.
				el(
					'div',
					{ ...blockProps, ref: hostRef },
					el( 'frak-button-share', {
						preview: 'true',
						text: attr( attributes.text ),
						classname: attr( composeClassname( attributes.buttonStyle, attributes.classname ) ),
						placement: attr( attributes.placement ),
						'click-action': attr( attributes.clickAction ),
						// Boolean HTML attribute: spread the key in only when truthy so
						// React 18 actually strips it from the DOM when the toggle is off.
						...( attributes.useReward ? { 'use-reward': '' } : {} ),
						'no-reward-text': attr( attributes.noRewardText ),
						'target-interaction': attr( attributes.targetInteraction ),
					} )
				)
			);
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
