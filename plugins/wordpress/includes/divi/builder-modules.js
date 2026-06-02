/**
 * Divi 4 Visual Builder React twins for the Frak modules.
 *
 * Divi modules declared with `$vb_support = 'on'` (see
 * {@see Frak_Divi_Module_Base}) get their live in-builder preview from a React
 * component instead of an AJAX re-run of the PHP `render()`. Registering one
 * here per module is what silences Divi's "this module has no React component"
 * notice and gives the instant, flicker-free preview that updates as the
 * merchant types.
 *
 * These are intentionally *thin wrappers*: each `render()` returns the same
 * `<frak-*>` web component the PHP renderer ({@see Frak_Component_Renderer})
 * emits, with the merchant's field values forwarded as the same kebab-case
 * HTML attributes — so the builder preview and the published frontend stay
 * byte-equivalent. The wrappers always paint in `preview` mode because they
 * only ever run inside the builder: the bare `preview="true"` attribute makes
 * the web component bypass the backend RPC gates that would otherwise keep it
 * hidden until a referral / merchant context exists (mirrors the Gutenberg
 * `editor.js` paths).
 *
 * No build step: this is hand-authored plain JS using `React.createElement`
 * against the `window.React` Divi already exposes in the builder — the exact
 * approach Elegant Themes' own `d5-extension-example-modules` ships, and the
 * same one the block `editor.js` files use with `wp.element.createElement`.
 * The fields arrive on `this.props` under their snake_case `get_fields()` keys.
 *
 * Loaded only inside the Visual Builder by
 * {@see Frak_Divi::enqueue_builder_modules()}; the matching PHP slugs are
 * `frak_divi_banner`, `frak_divi_share_button`, `frak_divi_post_purchase`.
 *
 * @package Frak_Integration
 */
/* global window, React, jQuery */
( function ( React, $ ) {
	'use strict';

	if ( ! React || ! $ ) {
		return;
	}

	const el = React.createElement;

	// Drop empty / unset values so the `<frak-*>` element only receives
	// attributes the merchant actually set — the web component already has
	// sensible defaults for the rest. Returning null (not undefined) lets
	// React call `removeAttribute()` on the custom element when a field is
	// cleared, instead of leaving a stale attribute stuck in the DOM. Same
	// helper the block `editor.js` files use.
	function attr( value ) {
		return value !== '' && value !== undefined && value !== null
			? String( value )
			: null;
	}

	// WordPress-native button-style presets for the Share Button. Mirrors
	// `Frak_Component_Renderer::SHARE_BUTTON_STYLE_CLASSES` +
	// `share-button/editor.js` so the in-builder preview inherits the same
	// theme button styling as the frontend.
	const BUTTON_STYLE_CLASSES = {
		primary: 'wp-element-button wp-block-button__link',
		secondary: 'wp-element-button wp-block-button__link is-style-outline',
		none: '',
	};

	function composeShareClassname( buttonStyle, classname ) {
		const preset =
			BUTTON_STYLE_CLASSES[ buttonStyle ] !== undefined
				? BUTTON_STYLE_CLASSES[ buttonStyle ]
				: BUTTON_STYLE_CLASSES.primary;
		return [ preset, classname ].filter( Boolean ).join( ' ' ).trim();
	}

	// Divi `yes_no_button` fields deliver the literal strings 'on' / 'off';
	// the web component reads `allow-inapp-redirect="true"`, so map 'on' → true
	// and drop everything else (matches
	// `Frak_Component_Renderer::TRUE_VALUED_HTML_ATTRS`).
	function yesNoToTrue( value ) {
		return value === 'on' || value === true ? 'true' : null;
	}

	// The SDK observes *camelCase* attributes (`referralTitle`), but these
	// twins set *kebab-case* ones (`referral-title`); preact-custom-element
	// therefore never fires `attributeChangedCallback` on edits and only reads
	// new values on (re)mount. Keying the element on its own attribute values
	// remounts it on any field change, so the preview updates live rather than
	// only after a save/reload. (Same remount trick as `blocks/banner/editor.js`.)
	function reactive( attrs ) {
		return Object.assign( { key: JSON.stringify( attrs ) }, attrs );
	}

	/**
	 * `<frak-banner>` twin. Slug must match {@see Frak_Divi_Banner_Module::$slug}.
	 */
	class FrakDiviBannerModule extends React.Component {
		render() {
			const props = this.props;
			// "Disabled": render nothing in the builder so a banner in a global
			// header / footer / template doesn't paint on every edited page.
			// Frontend is untouched — PHP render() drives it, not this twin.
			if ( props.preview_mode === 'none' ) {
				return null;
			}
			return el( 'frak-banner', reactive( {
				preview: 'true',
				'preview-mode': attr( props.preview_mode ) || 'referral',
				placement: attr( props.placement ),
				classname: attr( props.classname ),
				interaction: attr( props.interaction ),
				'referral-title': attr( props.referral_title ),
				'referral-description': attr( props.referral_description ),
				'referral-cta': attr( props.referral_cta ),
				'inapp-title': attr( props.inapp_title ),
				'inapp-description': attr( props.inapp_description ),
				'inapp-cta': attr( props.inapp_cta ),
				'image-url': attr( props.image_url ),
				'allow-inapp-redirect': yesNoToTrue( props.allow_inapp_redirect ),
			} ) );
		}
	}
	FrakDiviBannerModule.slug = 'frak_divi_banner';

	/**
	 * `<frak-button-share>` twin. Slug must match
	 * {@see Frak_Divi_Share_Button_Module::$slug}.
	 */
	class FrakDiviShareButtonModule extends React.Component {
		render() {
			const props = this.props;
			return el( 'frak-button-share', reactive( {
				preview: 'true',
				text: attr( props.text ),
				classname: attr(
					composeShareClassname( props.button_style, props.classname )
				),
				placement: attr( props.placement ),
				'click-action': attr( props.click_action ),
				'no-reward-text': attr( props.no_reward_text ),
				'target-interaction': attr( props.target_interaction ),
			} ) );
		}
	}
	FrakDiviShareButtonModule.slug = 'frak_divi_share_button';

	/**
	 * `<frak-post-purchase>` twin. Slug must match
	 * {@see Frak_Divi_Post_Purchase_Module::$slug}.
	 *
	 * The WooCommerce order context (customer / order / token / products) is
	 * deliberately not forwarded here — it only exists on a live thank-you /
	 * view-order request, which the builder canvas is not. The PHP renderer
	 * injects it on the published page.
	 */
	class FrakDiviPostPurchaseModule extends React.Component {
		render() {
			const props = this.props;
			return el( 'frak-post-purchase', reactive( {
				preview: 'true',
				'preview-variant': attr( props.preview_variant ) || 'referrer',
				'sharing-url': attr( props.sharing_url ),
				'merchant-id': attr( props.merchant_id ),
				placement: attr( props.placement ),
				classname: attr( props.classname ),
				variant: attr( props.variant ),
				'badge-text': attr( props.badge_text ),
				'referrer-text': attr( props.referrer_text ),
				'referee-text': attr( props.referee_text ),
				'cta-text': attr( props.cta_text ),
				'image-url': attr( props.image_url ),
			} ) );
		}
	}
	FrakDiviPostPurchaseModule.slug = 'frak_divi_post_purchase';

	// Divi fires `et_builder_api_ready` on `window` once the builder registry
	// is up, handing the registration API as the second jQuery-event argument.
	// `registerModules` matches each class to its PHP module by `static slug`.
	$( window ).on( 'et_builder_api_ready', function ( event, API ) {
		API.registerModules( [
			FrakDiviBannerModule,
			FrakDiviShareButtonModule,
			FrakDiviPostPurchaseModule,
		] );
	} );
} )( window.React, window.jQuery );
