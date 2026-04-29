<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakWebhookHelper;
use PHPUnit\Framework\TestCase;

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
