<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

/**
 * GuzzleHttp\ClientFactory is a Magento-generated factory class that does not ship
 * as a concrete PHP class in any Composer package. It is created at runtime by
 * Magento's code generation. This stub allows PHPUnit to mock it in unit tests
 * without requiring a full Magento installation.
 */
if (!class_exists(\GuzzleHttp\ClientFactory::class)) {
    // phpcs:ignore PSR1.Classes.ClassDeclaration.MultipleClasses
    class_alias(\FrakLabs\Sdk\Test\Stub\GuzzleClientFactory::class, \GuzzleHttp\ClientFactory::class);
}
