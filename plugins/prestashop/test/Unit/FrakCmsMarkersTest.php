<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakCmsMarkers;
use FrakComponentRenderer;
use FrakSmartyPlugins;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

require_once __DIR__ . '/../../classes/FrakComponentRenderer.php';
require_once __DIR__ . '/../../classes/FrakCmsMarkers.php';
require_once __DIR__ . '/../../classes/FrakSmartyPlugins.php';

final class FrakCmsMarkersTest extends TestCase
{
    public function testEveryMarkerNameIsARendererMethodAndASmartyTag(): void
    {
        $components = (new ReflectionClass(FrakCmsMarkers::class))->getConstant('COMPONENTS');

        foreach ($components as $name => $method) {
            $this->assertTrue(method_exists(FrakComponentRenderer::class, $method), $name . ' -> ' . $method);
            $reflection = new ReflectionMethod(FrakComponentRenderer::class, $method);
            $this->assertTrue($reflection->isPublic() && $reflection->isStatic(), $method . ' must be public static');
        }

        $registered = new class () {
            /** @var string[] */
            public array $names = [];

            public function registerPlugin($type, $name, $callback): void
            {
                \PHPUnit\Framework\Assert::assertIsCallable($callback, $name);
                $this->names[] = $name;
            }
        };
        $property = new \ReflectionProperty(FrakSmartyPlugins::class, 'registered');
        $property->setValue(null, false);
        FrakSmartyPlugins::register((object) ['smarty' => $registered]);
        $property->setValue(null, false);

        $tags = array_map(static fn (string $name): string => 'frak_' . $name, array_keys($components));
        $this->assertEqualsCanonicalizing($tags, $registered->names);
    }

    public function testLoneMarkerReplacesItsWholeParagraph(): void
    {
        $html = FrakCmsMarkers::replace('<p>Intro</p><p>{frak_ambassador}</p><p>Outro</p>');

        $this->assertSame('<p>Intro</p><frak-ambassador></frak-ambassador><p>Outro</p>', $html);
    }

    public function testMarkerPaddedByNbspStillReplacesItsParagraph(): void
    {
        $html = FrakCmsMarkers::replace('<p>&nbsp;{frak_ambassador}&nbsp;</p>');

        $this->assertSame('<frak-ambassador></frak-ambassador>', $html);
    }

    public function testMarkerInsideTextIsReplacedInPlace(): void
    {
        $html = FrakCmsMarkers::replace('<p>Join us {frak_ambassador} today</p>');

        $this->assertSame('<p>Join us <frak-ambassador></frak-ambassador> today</p>', $html);
    }

    public function testCleanerEncodedAmpersandIsDecodedOnceAndEscapedOnce(): void
    {
        $html = FrakCmsMarkers::replace('<p>{frak_share_button text="Share &amp; earn"}</p>');

        $this->assertStringContainsString('<frak-button-share', $html);
        $this->assertStringContainsString('text="Share &amp; earn"', $html);
        $this->assertStringNotContainsString('&amp;amp;', $html);
    }

    public function testSingleQuotedAndEntityQuotedValuesParse(): void
    {
        $html = FrakCmsMarkers::replace("{frak_banner placement='hero' referral_title=&quot;Hi&quot; inapp_cta=&#39;Go&#39;}");

        $this->assertSame(
            '<frak-banner placement="hero" referral-title="Hi" inapp-cta="Go"></frak-banner>',
            $html
        );
    }

    public function testBraceInsideQuotedValueDoesNotEndTheMarker(): void
    {
        $html = FrakCmsMarkers::replace('{frak_share_button text="Earn up to {REWARD}"}');

        $this->assertStringContainsString('text="Earn up to {REWARD}"', $html);
    }

    public function testUnknownAttributeIsDropped(): void
    {
        $html = FrakCmsMarkers::replace('{frak_ambassador foo="x" classname="wide"}');

        $this->assertSame('<frak-ambassador classname="wide"></frak-ambassador>', $html);
    }

    public function testAmbassadorAcceptsOnlyClassname(): void
    {
        $html = FrakCmsMarkers::replace('{frak_ambassador placement="home" text="x"}');

        $this->assertSame('<frak-ambassador></frak-ambassador>', $html);
    }

    public function testPostPurchaseMarkerRenders(): void
    {
        $html = FrakCmsMarkers::replace('{frak_post_purchase variant="referrer" cta_text="Earn"}');

        $this->assertSame('<frak-post-purchase variant="referrer" cta-text="Earn"></frak-post-purchase>', $html);
    }

    /**
     * @dataProvider untouchedProvider
     */
    public function testMarkersThatDoNotParseStayAsTyped(string $content): void
    {
        $this->assertSame($content, FrakCmsMarkers::replace($content));
    }

    /** @return array<string, array{string}> */
    public static function untouchedProvider(): array
    {
        return [
            'unknown tag' => ['<p>{frak_unknown}</p>'],
            'unterminated quote' => ['<p>{frak_banner text="unterminated}</p><p>"x"</p>'],
            'space after brace' => ['<p>{ frak_banner }</p>'],
            'longer tag name' => ['<p>{frak_banner_extra}</p>'],
            'no marker' => ['<p>Plain page</p>'],
        ];
    }

    public function testTwoMarkersOnOnePageBothRender(): void
    {
        $html = FrakCmsMarkers::replace('<p>{frak_banner}</p><p>text</p><p>{frak_ambassador}</p>');

        $this->assertSame(
            '<frak-banner></frak-banner><p>text</p><frak-ambassador></frak-ambassador>',
            $html
        );
    }

    public function testFilterArgsSwapsObjectContentAndKeepsOtherKeys(): void
    {
        $args = [
            'object' => ['id' => 7, 'meta_title' => 'Ambassador', 'content' => '<p>{frak_ambassador}</p>'],
            'other' => 'kept',
        ];

        $result = FrakCmsMarkers::filterArgs($args);

        $this->assertSame(
            [
                'object' => ['id' => 7, 'meta_title' => 'Ambassador', 'content' => '<frak-ambassador></frak-ambassador>'],
                'other' => 'kept',
            ],
            $result
        );
    }

    public function testFilterArgsReturnsArgsUnchangedWithoutMarker(): void
    {
        $args = ['object' => ['id' => 7, 'content' => '<p>Hello</p>']];

        $this->assertSame($args, FrakCmsMarkers::filterArgs($args));
    }

    public function testFilterArgsToleratesMissingContent(): void
    {
        $this->assertSame([], FrakCmsMarkers::filterArgs([]));
    }
}
