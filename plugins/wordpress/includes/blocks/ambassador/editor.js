/* global wp */
( function ( blocks, element, blockEditor, i18n ) {
	'use strict';

	const el = element.createElement;
	const { useEffect, useRef } = element;
	const { useBlockProps } = blockEditor;
	const { __ } = i18n;

	blocks.registerBlockType( 'frak/ambassador', {
		// Inserted wide, like the page Settings creates; a default `align` attribute would make "None" unselectable.
		variations: [
			{
				name: 'wide',
				title: __( 'Frak Ambassador', 'frak' ),
				isDefault: true,
				scope: [ 'inserter' ],
				attributes: { align: 'wide' },
			},
		],
		edit() {
			const hostRef = useRef( null );
			const blockProps = useBlockProps( {
				className: 'frak-block-editor frak-block-editor--ambassador',
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

			// No `preview` attribute: the component paints its static sections
			// without waiting for the merchant config.
			return el( 'div', { ...blockProps, ref: hostRef }, el( 'frak-ambassador' ) );
		},
		save() {
			return null;
		},
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.i18n );
