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
 *   - `frak_webhook_logs` (autoload=no) — growing list, read only on the settings page.
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
	const CURRENT_VERSION = 1;

	/**
	 * Legacy individual option keys that 1.0 used. Migrated into
	 * {@see self::OPTION_KEY} on upgrade.
	 *
	 * @var array<string, string>
	 */
	private const LEGACY_OPTIONS = array(
		'app_name'                 => 'frak_app_name',
		'logo_url'                 => 'frak_logo_url',
		'enable_purchase_tracking' => 'frak_enable_purchase_tracking',
		'enable_floating_button'   => 'frak_enable_floating_button',
		'show_reward'              => 'frak_show_reward',
		'button_classname'         => 'frak_button_classname',
		'floating_button_position' => 'frak_floating_button_position',
		'modal_language'           => 'frak_modal_language',
		'modal_i18n'               => 'frak_modal_i18n',
	);

	/**
	 * Default values per setting key.
	 *
	 * @var array<string, mixed>
	 */
	private const DEFAULTS = array(
		'app_name'                 => '',
		'logo_url'                 => '',
		'enable_purchase_tracking' => 0,
		'enable_floating_button'   => 0,
		'show_reward'              => 0,
		'button_classname'         => '',
		'floating_button_position' => 'right',
		'modal_language'           => 'default',
		'modal_i18n'               => '{}',
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
	 * Run one-time migration from legacy `frak_*` options into the bundled array.
	 * Safe to call on every request — no-ops after the first successful run.
	 */
	public static function migrate() {
		$version = (int) get_option( self::VERSION_OPTION, 0 );
		if ( $version >= self::CURRENT_VERSION ) {
			return;
		}

		$migrated = array();
		foreach ( self::LEGACY_OPTIONS as $new_key => $legacy_key ) {
			$legacy_value = get_option( $legacy_key, null );
			if ( null !== $legacy_value ) {
				$migrated[ $new_key ] = $legacy_value;
			}
		}

		if ( ! empty( $migrated ) ) {
			$existing = get_option( self::OPTION_KEY, array() );
			$existing = is_array( $existing ) ? $existing : array();
			update_option( self::OPTION_KEY, array_merge( $existing, $migrated ) );
		}

		foreach ( self::LEGACY_OPTIONS as $legacy_key ) {
			delete_option( $legacy_key );
		}

		update_option( self::VERSION_OPTION, self::CURRENT_VERSION );
		self::$cache = null;
	}
}
