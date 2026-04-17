<?php
/**
 * Uninstall cleanup.
 *
 * Fires when the merchant deletes the plugin from the Plugins admin screen
 * (distinct from deactivation — see `frak-integration.php`). Removes every
 * option, transient, and WooCommerce webhook the plugin owns so a fresh
 * install starts with a clean slate.
 *
 * WordPress guards this file by defining `WP_UNINSTALL_PLUGIN` before
 * including it; bail when that constant is absent to prevent direct
 * access from scanning tools or curious operators.
 *
 * @package Frak_Integration
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Plugin-owned option rows (single source of truth; mirrors the constants
// defined on `Frak_Settings` / `Frak_Merchant` / `Frak_WC_Webhook_Registrar`
// to avoid having to bootstrap the full autoloader just to read them).
$frak_options = array(
	'frak_settings',
	'frak_settings_version',
	'frak_webhook_secret',
	'frak_merchant',
	'frak_wc_webhook_id',
);

foreach ( $frak_options as $frak_option ) {
	delete_option( $frak_option );
}

// Short-lived transients used as negative cache / concurrency lock. Safe
// to delete even when the underlying key is already absent.
delete_transient( 'frak_merchant_unresolved' );
delete_transient( 'frak_wc_webhook_ensure_lock' );

// If WooCommerce is still active, drop the Frak-owned webhook row as well
// so the merchant's Webhooks admin UI doesn't keep a dangling entry. We
// avoid class_exists() on our own classes here because the autoloader may
// not have been hydrated for this request, and we do not want to rely on
// it during uninstall.
if ( function_exists( 'wc_get_webhook' ) ) {
	$frak_webhook_id = (int) get_option( 'frak_wc_webhook_id', 0 );
	if ( $frak_webhook_id ) {
		$frak_webhook = wc_get_webhook( $frak_webhook_id );
		if ( $frak_webhook && is_callable( array( $frak_webhook, 'delete' ) ) ) {
			$frak_webhook->delete( true );
		}
	}
}
