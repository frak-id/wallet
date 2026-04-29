<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakComponentRenderer;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../classes/FrakComponentRenderer.php';

/**
 * Cover the pure helpers exposed by the renderer: the snake_case → camelCase
 * key normaliser used at the Smarty function plugin boundary, and the
 * markup-emitting public methods (which do not hit any PrestaShop runtime).
 */
final class FrakComponentRendererTest extends TestCase
{
    public function testSnakeKeysToCamelCovertsUnderscoredKeys(): void
    {
        $result = FrakComponentRenderer::snakeKeysToCamel([
            'referral_title' => 'Welcome',
            'referral_description' => 'Hi',
            'inapp_cta' => 'Open',
        ]);

        $this->assertSame(
            ['referralTitle' => 'Welcome', 'referralDescription' => 'Hi', 'inappCta' => 'Open'],
            $result
        );
    }

    public function testSnakeKeysToCamelLeavesCamelCaseKeysUntouched(): void
    {
        // Smarty templates that already use camelCase keys (or hook callbacks
        // re-using the helper) should pass through unchanged so the helper is
        // safe to call unconditionally at the boundary.
        $result = FrakComponentRenderer::snakeKeysToCamel([
            'referralTitle' => 'Welcome',
            'placement' => 'home',
        ]);

        $this->assertSame(['referralTitle' => 'Welcome', 'placement' => 'home'], $result);
    }

    public function testSnakeKeysToCamelHandlesEmptyInput(): void
    {
        $this->assertSame([], FrakComponentRenderer::snakeKeysToCamel([]));
    }

    public function testBannerEmitsBareTagWhenNoAttributesSupplied(): void
    {
        $this->assertSame('<frak-banner></frak-banner>', FrakComponentRenderer::banner());
    }

    public function testBannerForwardsKnownAttributesAsKebabCase(): void
    {
        $html = FrakComponentRenderer::banner([
            'placement' => 'home',
            'referralTitle' => 'Welcome back',
        ]);

        $this->assertStringContainsString('placement="home"', $html);
        $this->assertStringContainsString('referral-title="Welcome back"', $html);
    }

    public function testShareButtonAppliesDefaultBootstrapStyle(): void
    {
        // Default preset is `secondary` so the rendered button picks up
        // Bootstrap styling out of the box on PrestaShop themes.
        $html = FrakComponentRenderer::shareButton(['text' => 'Share']);

        $this->assertStringContainsString('classname="btn btn-secondary"', $html);
        $this->assertStringContainsString('text="Share"', $html);
    }

    public function testShareButtonRespectsExplicitButtonStyleNone(): void
    {
        // `'buttonStyle' => 'none'` opts the merchant out of the default
        // preset entirely — useful when the theme already styles the button
        // through a custom selector.
        $html = FrakComponentRenderer::shareButton([
            'text' => 'Share',
            'buttonStyle' => 'none',
        ]);

        $this->assertStringNotContainsString('classname="btn', $html);
    }

    public function testBooleanAttributesAreEmittedBareWhenTruthy(): void
    {
        // The web component treats `<frak-button-share use-reward>` as an
        // "on" toggle; emitting `use-reward="1"` would coerce to text content
        // rather than a boolean toggle.
        $html = FrakComponentRenderer::shareButton(['useReward' => true]);

        $this->assertStringContainsString(' use-reward', $html);
        $this->assertStringNotContainsString('use-reward=', $html);
    }

    public function testEmptyAttributesAreOmitted(): void
    {
        // Empty strings / nulls should not produce empty `attr=""` pairs that
        // could confuse the SDK at runtime.
        $html = FrakComponentRenderer::banner([
            'placement' => 'home',
            'referralTitle' => '',
            'inappCta' => null,
        ]);

        $this->assertStringContainsString('placement="home"', $html);
        $this->assertStringNotContainsString('referral-title=""', $html);
        $this->assertStringNotContainsString('inapp-cta=""', $html);
    }

    public function testPurchaseTrackerScriptEmitsTrackPurchaseStatusCall(): void
    {
        // The tracker is emitted independently of the post-purchase component
        // placement so attribution survives the merchant disabling the visible
        // card. The script must be self-contained (no external deps) and
        // resilient to SDK boot-order races (`frak:client` listener fallback).
        $script = FrakComponentRenderer::purchaseTrackerScript([
            'customerId' => '42',
            'orderId' => '999',
            'token' => 'abc_999',
        ]);

        $this->assertStringStartsWith('<script>', $script);
        $this->assertStringContainsString('trackPurchaseStatus', $script);
        $this->assertStringContainsString('"customerId":"42"', $script);
        $this->assertStringContainsString('"orderId":"999"', $script);
        $this->assertStringContainsString('"token":"abc_999"', $script);
        $this->assertStringContainsString('frak:client', $script);
    }
}
