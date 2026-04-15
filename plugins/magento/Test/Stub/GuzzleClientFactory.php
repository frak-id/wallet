<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Test\Stub;

use GuzzleHttp\Client;

/**
 * Stub for GuzzleHttp\ClientFactory which is generated at runtime by Magento's DI.
 * Provides a mockable surface for unit tests without a full Magento installation.
 */
class GuzzleClientFactory
{
    /**
     * Create a Guzzle HTTP client instance
     *
     * @param array $config
     * @return Client
     */
    public function create(array $config = []): Client
    {
        return new Client($config);
    }
}
