<?php
/**
 * Plugin auto-updater wiring.
 *
 * Bridges YahnisElsts/plugin-update-checker (PUC) to our monorepo's GitHub
 * release flow so installs can pick up new versions through the standard
 * WordPress "Plugins → Updates" UI without us being listed on wordpress.org.
 *
 * Three monorepo-specific quirks need adapting:
 *
 *   1. Plugin source lives under `plugins/wordpress/`, not at the repo root,
 *     so PUC's metadata fetches (frak-integration.php, readme.txt,
 *     CHANGELOG.md) at the repo root return 404. PUC handles this
 *     gracefully — when the remote main file fetch fails, `$info->version`
 *     keeps the tag-derived value, and release notes (populated from the
 *     release `body` via Parsedown) are used as the changelog. Since
 *     `release-flow/keep-a-changelog-action` already pumps CHANGELOG.md
 *     content into release bodies, the "View version X.Y.Z details" panel
 *     still shows the right notes.
 *
 *   2. Tags are namespaced as `wordpress-X.Y.Z` (parallel to `magento-X.Y.Z`).
 *     `setReleaseFilter()` keeps PUC walking back through history past
 *     non-WordPress releases until it finds a matching tag. The
 *     `puc_request_info_result-{slug}` filter then strips the prefix from
 *     `$info->version` so WP's `version_compare()` doesn't compare strings.
 *
 *   3. The release asset is `frak-integration-X.Y.Z.zip` (built by
 *     `build.sh` with `vendor/` baked in). `enableReleaseAssets()` with
 *     `REQUIRE_RELEASE_ASSETS` ensures we never fall back to GitHub's
 *     auto-generated source archive — that archive would contain the
 *     entire monorepo and would activate then fatally error on first
 *     class lookup (no `vendor/`).
 *
 * Direct instantiation (vs. `PucFactory::buildUpdateChecker`) is a
 * deliberate choice: PUC's factory returns the base `Api` type from
 * `getVcsApi()`, which hides the trait-provided `setReleaseFilter()` and
 * `enableReleaseAssets()` methods from static analysis. Pinning the
 * `v5p6` namespace explicitly keeps PHPStan honest at the cost of one
 * search-replace per PUC minor bump (see `composer.json`'s `5.6.*`
 * constraint, which prevents that bump from happening silently).
 *
 * Operational dependencies and known trade-offs:
 *
 *   - GitHub anonymous API rate limit is 60 req/h per IP. PUC caches
 *     update checks for 12 h, so a single site costs at most 2 calls per
 *     day. Shared hosts behind a NAT'd egress IP could collide if many
 *     sites run multiple GitHub-backed updaters; the escape valve is
 *     authenticated requests via `setAuthentication()` (PAT, lifts to
 *     5,000/h) or moving to a static JSON metadata endpoint on a Frak
 *     domain. Neither is wired today — we'll add one if rate-limit
 *     errors start showing up in support.
 *
 *   - `composer.lock` is gitignored at the monorepo level, so the PUC
 *     patch version baked into each release zip is whatever Composer
 *     resolves at build time within the `5.6.*` constraint. Patch-level
 *     drift between releases is acceptable (PUC is conservative about
 *     breaking changes within a minor) but not strictly reproducible —
 *     `release-wordpress.yml` runs `composer install --no-dev` fresh per
 *     release.
 *
 * @package Frak_Integration
 */

use YahnisElsts\PluginUpdateChecker\v5p6\Vcs\Api;
use YahnisElsts\PluginUpdateChecker\v5p6\Vcs\GitHubApi;
use YahnisElsts\PluginUpdateChecker\v5p6\Vcs\PluginUpdateChecker;

/**
 * Class Frak_Updater
 */
class Frak_Updater {

	/**
	 * Tag prefix the WordPress release workflow stamps on every tag.
	 * Mirrors Magento's own `magento-` prefix; both are namespaced because
	 * the monorepo houses multiple plugins.
	 */
	private const TAG_PREFIX = 'wordpress-';

	/**
	 * Re-entry guard — PUC fatals on duplicate slug registration in
	 * `Plugin\UpdateChecker::__construct()`, so a second `init()` call from
	 * a future refactor (or a test harness) would crash the request. The
	 * boot path today calls this once via `Frak_Plugin::boot()`, but the
	 * guard makes the idempotency claim defensive rather than aspirational.
	 *
	 * @var bool
	 */
	private static bool $initialized = false;

	/**
	 * Bootstrap the update checker. Idempotent — the static guard above
	 * makes a second call a no-op. Called from {@see Frak_Plugin::boot()}
	 * on `plugins_loaded` so PUC's hooks (admin update notices + WP cron's
	 * `pre_set_site_transient_update_plugins`) are wired before the first
	 * update transient refresh.
	 */
	public static function init() {
		if ( self::$initialized ) {
			return;
		}
		if ( ! class_exists( GitHubApi::class ) ) {
			return;
		}
		self::$initialized = true;

		$api = new GitHubApi( 'https://github.com/frak-id/wallet/' );
		new PluginUpdateChecker( $api, FRAK_PLUGIN_FILE, 'frak-integration' );

		// Filter releases by tag prefix. Without this, a Magento release at
		// the head of the list would short-circuit `getLatestRelease()` —
		// REQUIRE_RELEASE_ASSETS returns null on the first release whose
		// assets don't match the regex, before iterating to the next one.
		// Filtering by tag prefix lets PUC walk past Magento (and any future
		// plugin) releases until it lands on a `wordpress-*` tag.
		//
		// Scan depth is 100 (PUC's max). The fallback paths inside
		// `getLatestRelease()` don't help us if the latest WordPress release
		// falls outside this window: `getLatestTag()` rejects `wordpress-X.Y.Z`
		// via `looksLikeVersion()` (expects `vX.Y.Z` or bare `X.Y.Z`), and the
		// branch fallback fails because `frak-integration.php` isn't at the
		// repo root. 100 covers the realistic worst case of Magento + Shopify
		// + future-plugin releases stacking up between WordPress releases.
		$api->setReleaseFilter(
			static function ( $version_number, $release ) {
				unset( $version_number );
				return is_object( $release )
					&& isset( $release->tag_name )
					&& 0 === strncmp( $release->tag_name, self::TAG_PREFIX, strlen( self::TAG_PREFIX ) );
			},
			Api::RELEASE_FILTER_SKIP_PRERELEASE,
			100
		);

		// Use the packaged release zip (vendor/ included). The auto-generated
		// source archive would contain the entire monorepo and would be
		// missing vendor/ — activation succeeds but every class lookup
		// fatally errors. REQUIRE_RELEASE_ASSETS forbids that fallback.
		$api->enableReleaseAssets( '/^frak-integration-.*\.zip$/', Api::REQUIRE_RELEASE_ASSETS );

		// Strip the `wordpress-` prefix from the parsed version so WP's
		// `version_compare()` and the upgrader's display string treat
		// `wordpress-1.1.2` as `1.1.2`. PUC derives the version via
		// `ltrim($tag, 'v')`, which leaves the prefix intact.
		add_filter(
			'puc_request_info_result-frak-integration',
			array( __CLASS__, 'strip_tag_prefix_from_version' )
		);
	}

	/**
	 * Filter callback for `puc_request_info_result-{slug}`. Strips the
	 * `wordpress-` tag prefix from `$info->version` so the comparison
	 * against the locally installed version is a real version check.
	 *
	 * @param object|null $info PUC plugin info (PluginInfo). Null on failure.
	 * @return object|null
	 */
	public static function strip_tag_prefix_from_version( $info ) {
		if ( ! is_object( $info ) || empty( $info->version ) || ! is_string( $info->version ) ) {
			return $info;
		}

		$prefix_len = strlen( self::TAG_PREFIX );
		if ( 0 === strncmp( $info->version, self::TAG_PREFIX, $prefix_len ) ) {
			$info->version = substr( $info->version, $prefix_len );
		}

		return $info;
	}
}
