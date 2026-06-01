<?php
/**
 * Frontend functionality.
 *
 * Stateless static class — follows the same pattern as {@see Frak_WooCommerce}
 * and {@see Frak_WC_Webhook_Registrar}. All handlers are static so no
 * instance is held in memory between requests.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Frontend
 */
class Frak_Frontend {

	/**
	 * Guard so the opt-in site-wide `<frak-banner>` is emitted at most once
	 * per request, even if a theme fires `wp_body_open` more than once (rare,
	 * but some page builders re-open the body wrapper). Mirrors the single-
	 * boolean latch used for the auto-rendered post-purchase card in
	 * {@see Frak_WooCommerce}.
	 *
	 * @var bool
	 */
	private static bool $banner_rendered = false;

	/**
	 * Register frontend hooks. Called once from {@see Frak_Plugin::init()}.
	 */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_scripts' ), 20 );
		add_filter( 'wp_resource_hints', array( __CLASS__, 'add_resource_hints' ), 10, 2 );

		// Opt-in: inject <frak-banner> at the top of every page (right after
		// <body> via wp_body_open) when the merchant enables "Auto-render
		// Banner" in Settings → Frak. Lets merchants run the referral /
		// in-app-browser banner site-wide without dropping the block, shortcode,
		// or widget on every template — handy on theme/page builders where
		// editing the global header is painful. The banner auto-hides when there
		// is no referral or in-app context, so it stays inert on ordinary page
		// views. No hook is registered (zero per-request cost) when off.
		if ( Frak_Settings::get( 'auto_render_banner' ) ) {
			add_action( 'wp_body_open', array( __CLASS__, 'render_banner' ) );
		}
	}

	/**
	 * Auto-inject the `<frak-banner>` at the top of every page.
	 *
	 * Hooked to `wp_body_open` (right after the opening `<body>` tag) only when
	 * the merchant enables "Auto-render Banner" in Settings → Frak (see
	 * {@see init()}). Gives merchants a zero-template-edit way to run the
	 * referral / in-app-browser banner site-wide — useful on theme/page
	 * builders where editing the global header to add a block is painful.
	 *
	 * Delegates to {@see Frak_Component_Renderer::banner()} with no
	 * caller-supplied attributes, so the markup is byte-identical to the block,
	 * shortcode, and widget surfaces and the SDK pulls all copy from the
	 * merchant's backend config. `<frak-banner>` auto-hides when there is no
	 * referral success or in-app-browser context, so it is inert on ordinary
	 * page views.
	 *
	 * Emitted at most once per request (see {@see $banner_rendered}). Themes
	 * that don't implement `wp_body_open()` won't render it — acceptable since
	 * that hook is the canonical top-of-body injection point on WP 5.2+ (this
	 * plugin requires 6.4+).
	 */
	public static function render_banner() {
		if ( self::$banner_rendered ) {
			return;
		}
		self::$banner_rendered = true;

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Frak_Component_Renderer escapes every attribute internally; the bare web component markup carries no wrapper.
		echo Frak_Component_Renderer::banner( array() );
	}

	/**
	 * Enqueue frontend scripts.
	 *
	 * Always loaded on frontend requests (classic + block themes): the SDK
	 * pulls its real metadata (merchant name, reward UI copy, etc.) from the
	 * Frak backend once the merchant is registered on business.frak.id, so
	 * the plugin must inject the script even when no WP-side `app_name` /
	 * `logo_url` is configured. {@see generate_config_script()} falls back
	 * to `get_bloginfo('name')` so `window.FrakSetup.config.metadata.name`
	 * is never empty.
	 */
	public static function enqueue_scripts() {
		// Inside the Divi Visual Builder the module markup is injected by the
		// React twins (`includes/divi/builder-modules.js`) *after* the page has
		// loaded. A deferred, footer-loaded SDK can execute after those
		// injections, leaving the `<frak-*>` custom elements unupgraded so the
		// preview renders blank. Loading the SDK render-blocking in <head>
		// guarantees `customElements.define()` has run before any module
		// renders. The builder is not perf-sensitive, so the blocking load is
		// an acceptable trade there; the public frontend keeps the deferred,
		// footer-loaded script. Elementor's preview uses a full frontend
		// iframe (no post-load injection) so it is intentionally not covered.
		$in_divi_builder = class_exists( 'Frak_Divi' ) && Frak_Divi::is_editor_context();
		$script_args     = $in_divi_builder
			? array( 'in_footer' => false )
			: array(
				'in_footer' => true,
				'strategy'  => 'defer',
			);

		wp_enqueue_script(
			'frak-sdk',
			'https://cdn.jsdelivr.net/npm/@frak-labs/components',
			array(),
			null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters -- CDN serves latest version; avoid ?ver= query param.
			$script_args
		);

		// Inline config injected 'before' the SDK so window.FrakSetup is populated prior to SDK bootstrap.
		wp_add_inline_script( 'frak-sdk', self::generate_config_script(), 'before' );
	}

	/**
	 * Append DNS-prefetch / preconnect hints for the SDK origin so the
	 * browser can warm the TLS handshake before the `<script>` tag parses.
	 *
	 * @param array<int, string|array<string, string>> $hints    Existing hints from core.
	 * @param string                                   $relation Relation type being filtered.
	 * @return array<int, string|array<string, string>>
	 */
	public static function add_resource_hints( $hints, $relation ) {
		if ( 'dns-prefetch' === $relation ) {
			$hints[] = 'https://cdn.jsdelivr.net';
		}
		if ( 'preconnect' === $relation ) {
			$hints[] = array(
				'href'        => 'https://cdn.jsdelivr.net',
				'crossorigin' => 'anonymous',
			);
		}
		return $hints;
	}

	/**
	 * Generate the inline configuration script for window.FrakSetup.
	 *
	 * Shape matches the current SDK contract (see @frak-labs/components):
	 *   window.FrakSetup = { config: FrakWalletSdkConfig };
	 *
	 * Site-level metadata (name + logoUrl) is always emitted. Inside a page
	 * builder's editor / preview context — Elementor (detected via
	 * {@see Frak_Elementor::is_editor_context()}) or the Divi Visual Builder
	 * (detected via {@see Frak_Divi::is_editor_context()}) — we additionally
	 * flip `waitForBackendConfig` off so the live `<frak-X preview>` web
	 * components render immediately even on local dev where the merchant
	 * dashboard hasn't registered the domain yet — same trick the Gutenberg
	 * editor uses (see {@see Frak_Blocks::generate_editor_config_script()}).
	 *
	 * @return string
	 */
	private static function generate_config_script() {
		$app_name_raw = Frak_Settings::get( 'app_name' );
		$app_name     = '' !== $app_name_raw ? $app_name_raw : get_bloginfo( 'name' );
		$logo_url     = Frak_Settings::get( 'logo_url' );

		$metadata = array_filter(
			array(
				'name'    => $app_name,
				'logoUrl' => '' !== $logo_url ? $logo_url : null,
			),
			static function ( $value ) {
				return null !== $value && '' !== $value;
			}
		);

		$config = array( 'metadata' => $metadata );
		if (
			( class_exists( 'Frak_Elementor' ) && Frak_Elementor::is_editor_context() )
			|| ( class_exists( 'Frak_Divi' ) && Frak_Divi::is_editor_context() )
		) {
			$config['waitForBackendConfig'] = false;
		}

		$config_json = wp_json_encode( $config, JSON_UNESCAPED_SLASHES );

		return sprintf(
			'window.FrakSetup=Object.assign(window.FrakSetup||{},{config:%s});',
			$config_json
		);
	}
}
