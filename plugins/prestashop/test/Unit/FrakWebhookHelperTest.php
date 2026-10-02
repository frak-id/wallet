<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakInfra;
use FrakTestDbRecorder;
use FrakWebhookHelper;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

require_once __DIR__ . '/doubles.php';
require_once __DIR__ . '/../../classes/FrakEnv.php';
require_once __DIR__ . '/../../classes/FrakUrls.php';
require_once __DIR__ . '/../../classes/FrakUtils.php';
require_once __DIR__ . '/../../classes/FrakCache.php';
require_once __DIR__ . '/../../classes/FrakHttpClient.php';
require_once __DIR__ . '/../../classes/FrakMerchantResolver.php';
require_once __DIR__ . '/../../classes/FrakWebhookHelper.php';

/**
 * Pin the HMAC signature format. The backend (`services/backend/src/utils/bodyHmac.ts`)
 * decodes `x-hmac-sha256` via `Buffer.from(sig, 'base64')` and compares to a raw
 * `CryptoHasher` digest. Sending the default hex digest produces a 64-byte buffer
 * after base64-decoding (vs the expected 32-byte raw digest) and silently fails
 * verification — which was the regression that motivated this test.
 */
final class FrakWebhookHelperTest extends TestCase
{
    protected function setUp(): void
    {
        frak_test_reset_doubles();
        FrakInfra::resetAll();
    }

    public function testWebhookUrlIsProductionWhenNoConstantIsSet(): void
    {
        FrakTestDbRecorder::$cacheRows['merchant.shop_example_com'] = '{"id":"m-1","domain":"shop.example.com"}';

        $this->assertSame(
            'https://backend.frak.id/ext/merchant/m-1/webhook/custom',
            FrakWebhookHelper::getWebhookUrl()
        );
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testWebhookUrlFollowsTheDevBackend(): void
    {
        define('FRAK_ENV', 'dev');
        FrakTestDbRecorder::$cacheRows['dev_merchant.shop_example_com'] = '{"id":"m-2","domain":"shop.example.com"}';

        $this->assertSame(
            'https://backend.gcp-dev.frak.id/ext/merchant/m-2/webhook/custom',
            FrakWebhookHelper::getWebhookUrl()
        );
    }

    public function testBatchRecordsEveryRowWhenTheBackendAnswersWithAnErrorStatus(): void
    {
        $client = new MockHttpClient([
            new MockResponse('boom', ['http_code' => 500]),
            new MockResponse('nope', ['http_code' => 401]),
            new MockResponse('{"ok":true}', ['http_code' => 200]),
            new MockResponse('', ['error' => 'connection reset']),
        ]);
        $responses = [];
        $responseToId = [];
        foreach ([11, 12, 13, 14] as $rowId) {
            $response = $client->request('POST', 'https://backend.example/webhook');
            $responses[] = $response;
            $responseToId[spl_object_id($response)] = $rowId;
        }

        $results = FrakWebhookHelper::collectResponses($client, $responses, $responseToId);

        ksort($results);
        $this->assertSame([11, 12, 13, 14], array_keys($results));
        $this->assertSame(['success' => false, 'http_code' => 500, 'error' => 'HTTP 500: boom'], $results[11]);
        $this->assertSame(401, $results[12]['http_code']);
        $this->assertTrue($results[13]['success']);
        $this->assertStringStartsWith('Transport error:', $results[14]['error']);
    }

    public function testSignBodyMatchesBackendBase64Contract(): void
    {
        $body = '{"id":"42","customerId":"7","status":"confirmed","token":"abc_42"}';
        $secret = 'merchant-secret-32-chars-1234567';

        $signature = FrakWebhookHelper::signBody($body, $secret);

        // Round-trip the signature: decode as base64, recompute the raw HMAC, compare.
        // If the dispatcher ever regresses to hex output, base64_decode would either
        // return false or yield 64 bytes that fail the equals() check.
        $decoded = base64_decode($signature, true);
        $this->assertNotFalse($decoded, 'Signature must be valid base64');
        $this->assertSame(32, strlen($decoded), 'Decoded HMAC-SHA256 digest must be exactly 32 bytes');
        $this->assertSame(hash_hmac('sha256', $body, $secret, true), $decoded);
    }

    public function testSignBodyIsDeterministic(): void
    {
        $body = '{"hello":"world"}';
        $secret = 'k';

        $a = FrakWebhookHelper::signBody($body, $secret);
        $b = FrakWebhookHelper::signBody($body, $secret);

        $this->assertSame($a, $b);
    }

    public function testSignBodyChangesWhenBodyChanges(): void
    {
        $secret = 's';

        $this->assertNotSame(
            FrakWebhookHelper::signBody('a', $secret),
            FrakWebhookHelper::signBody('b', $secret)
        );
    }

    public function testSignBodyChangesWhenSecretChanges(): void
    {
        $body = 'payload';

        $this->assertNotSame(
            FrakWebhookHelper::signBody($body, 'one'),
            FrakWebhookHelper::signBody($body, 'two')
        );
    }
}
