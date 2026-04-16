<?php
/**
 * PHPStan bootstrap file.
 *
 * Declares plugin constants that are defined at runtime in frak-integration.php
 * so PHPStan can resolve them when analysing other files independently.
 *
 * @package Frak_Integration
 */

if ( ! defined( 'FRAK_PLUGIN_FILE' ) ) {
	define( 'FRAK_PLUGIN_FILE', '' );
}
if ( ! defined( 'FRAK_PLUGIN_DIR' ) ) {
	define( 'FRAK_PLUGIN_DIR', '' );
}
if ( ! defined( 'FRAK_PLUGIN_URL' ) ) {
	define( 'FRAK_PLUGIN_URL', '' );
}
