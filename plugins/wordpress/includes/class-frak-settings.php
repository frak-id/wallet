<?php
/**
 * Settings accessor and migration helper.
 *
 * All user-configurable settings are stored in a single autoloaded option
 * (`frak_settings`) instead of scattered `frak_*` rows. This keeps the
 * wp_options footprint minimal and collapses all lookups into a single
 * in-memory array after the initial hydration by WordPress.
 *
 * Semantics split:
 *   - `frak_settings` (autoloaded) — UI/config, read on every frontend request.
 *   - `frak_webhook_secret` (autoload=no) — credential, read only on webhook send/test.
 *
 * @package Frak_Integration
 */

/**
 * Class Frak_Settings
 */
class Frak_Settings {

	/**
	 * Option key storing the bundled settings array.
	 */
	const OPTION_KEY = 'frak_settings';

	/**
	 * Version marker to run migrations only once.
	 */
	const VERSION_OPTION = 'frak_settings_version';

	/**
	 * Current settings schema version. Bump when a migration is added.
	 */
	const CURRENT_VERSION = 2;

	/**
	 * Legacy individual option keys that an earlier, unreleased iteration of
	 * the plugin persisted. Migrated into {@see self::OPTION_KEY} on upgrade,
	 * then the legacy rows are deleted.
	 *
	 * @var array<string, string>
	 */
	private const LEGACY_OPTIONS = array(
		'app_name' => 'frak_app_name',
		'logo_url' => 'frak_logo_url',
	);

	/**
	Legacy `frak_*` option rows that the plugin no longer consumes. Kept
	only so the migration can purge them from wp_options on upgrade.
	 *
	 * `frak_webhook_logs` was a ring buffer (max 50 rows) populated by the v1
	 * PHP webhook dispatcher. The dispatcher is gone (delivery + logging now
	 * live in WooCommerce's native pipeline under `WooCommerce → Status → Logs`),
	 * so the option is dead weight — and was autoloaded on v1, which is the
	 * worst flavour of dead weight.
	 *
	 * @var string[]
	 */
	private const DEPRECATED_LEGACY_OPTIONS = array(
		'frak_enable_purchase_tracking',
		'frak_enable_floating_button',
		'frak_show_reward',
		'frak_button_classname',
		'frak_floating_button_position',
		'frak_modal_language',
		'frak_modal_i18n',
		'frak_webhook_logs',
	);

	/**
	 * Default values per setting key.
	 *
	 * @var array<string, mixed>
	 */
	private const DEFAULTS = array(
		'app_name' => '',
		'logo_url' => '',
	);

	/**
	 * Runtime cache of the decoded option array.
	 *
	 * @var array<string, mixed>|null
	 */
	private static $cache = null;

	/**
	 * Get a single setting, falling back to the registered default.
	 *
	 * @param string $key      Setting key (without `frak_` prefix).
	 * @param mixed  $fallback Optional caller-supplied default overriding the registered one.
	 * @return mixed
	 */
	public static function get( $key, $fallback = null ) {
		$settings = self::all();
		if ( array_key_exists( $key, $settings ) ) {
			return $settings[ $key ];
		}
		if ( null !== $fallback ) {
			return $fallback;
		}
		return self::DEFAULTS[ $key ] ?? null;
	}

	/**
	 * Return the full settings array merged with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function all() {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION_KEY, array() );
			$stored      = is_array( $stored ) ? $stored : array();
			self::$cache = array_merge( self::DEFAULTS, $stored );
		}
		return self::$cache;
	}

	/**
	 * Replace the full settings array (used by the admin save handler).
	 *
	 * @param array<string, mixed> $values Complete settings map.
	 */
	public static function replace( array $values ) {
		// Only persist keys we know about, to avoid pollution.
		$filtered    = array_intersect_key( $values, self::DEFAULTS );
		$merged      = array_merge( self::DEFAULTS, $filtered );
		self::$cache = $merged;
		update_option( self::OPTION_KEY, $merged );
	}

	/**
	 * Run one-time migration. Safe to call on every request — no-ops after
	 * the first successful run for the current {@see self::CURRENT_VERSION}.
	 *
	 * Imports surviving legacy rows into the bundle, deletes every known
	 * legacy row (both migrated and deprecated) from wp_options, and forces
	 * `frak_webhook_secret` to autoload=no so the credential is not loaded
	 * into memory on every request (WP 6.4+ API).
	 */
	public static function migrate() {
		$version = (int) get_option( self::VERSION_OPTION, 0 );
		if ( $version >= self::CURRENT_VERSION ) {
			return;
		}

		$existing = get_option( self::OPTION_KEY, array() );
		$existing = is_array( $existing ) ? $existing : array();

		foreach ( self::LEGACY_OPTIONS as $new_key => $legacy_key ) {
			if ( array_key_exists( $new_key, $existing ) ) {
				continue;
			}
			$legacy_value = get_option( $legacy_key, null );
			if ( null !== $legacy_value ) {
				$existing[ $new_key ] = $legacy_value;
			}
		}

		// Persist only known keys to keep the bundle tidy.
		update_option( self::OPTION_KEY, array_intersect_key( $existing, self::DEFAULTS ) );

		$legacy_to_delete = array_merge(
			array_values( self::LEGACY_OPTIONS ),
			self::DEPRECATED_LEGACY_OPTIONS
		);
		foreach ( $legacy_to_delete as $legacy_key ) {
			delete_option( $legacy_key );
		}

		// Force autoload=no on the webhook secret so existing installs upgraded
		// from v1 stop hydrating the credential on every request. Safe no-op
		// when the option is already non-autoloaded or absent.
		if ( function_exists( 'wp_set_option_autoload' ) ) {
			wp_set_option_autoload( 'frak_webhook_secret', false );
		}

		update_option( self::VERSION_OPTION, self::CURRENT_VERSION );
		self::$cache = null;
	}
}
