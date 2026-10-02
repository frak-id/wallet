<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use CMS;
use CmsController;
use Configuration;
use Context;
use FrakAmbassadorPage;
use FrakConfig;
use FrakFrontend;
use FrakTestDbRecorder;
use Language;
use PHPUnit\Framework\TestCase;
use PrestaShopException;
use PrestaShopLogger;

require_once __DIR__ . '/doubles.php';
require_once __DIR__ . '/../../classes/FrakEnv.php';
require_once __DIR__ . '/../../classes/FrakUrls.php';
require_once __DIR__ . '/../../classes/FrakUtils.php';
require_once __DIR__ . '/../../classes/FrakConfig.php';
require_once __DIR__ . '/../../classes/FrakComponentRenderer.php';
require_once __DIR__ . '/../../classes/FrakFrontend.php';
require_once __DIR__ . '/../../classes/FrakAmbassadorPage.php';

final class FrakAmbassadorPageTest extends TestCase
{
    private const MARKER = '{frak_ambassador}';

    protected function setUp(): void
    {
        frak_test_reset_doubles();
        Language::$languages = [
            ['id_lang' => 1, 'iso_code' => 'fr'],
            ['id_lang' => 2, 'iso_code' => 'en'],
        ];
    }

    public function testEnsureCreatesOneActivePageTitledPerLanguage(): void
    {
        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('created', $result['status']);
        $this->assertCount(1, CMS::$rows);
        $id = array_key_first(CMS::$rows);
        $page = CMS::$rows[$id];
        $this->assertTrue($page['active']);
        $this->assertSame([1 => 'Devenir ambassadeur', 2 => 'Become an ambassador'], $page['meta_title']);
        $this->assertSame([1 => 'devenir-ambassadeur', 2 => 'become-an-ambassador'], $page['link_rewrite']);
        $this->assertSame([1 => self::MARKER, 2 => self::MARKER], $page['content']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());

        $state = FrakAmbassadorPage::state();
        $this->assertSame('live', $state['type']);
        $this->assertSame($id, $state['id']);
        $this->assertTrue($state['created']);
        $this->assertSame('Devenir ambassadeur', $state['title']);
        $this->assertSame('https://shop.example/1/content/' . $id, $state['url']);
        $this->assertStringContainsString('updatecms=1&id_cms=' . $id, $state['editUrl']);
    }

    public function testMerchantBuiltPageIsLiveAndNothingIsCreated(): void
    {
        $id = CMS::seed([1 => '<p>Rejoignez-nous</p>{frak_ambassador}', 2 => '<p>Join us</p>{frak_ambassador}']);

        $state = FrakAmbassadorPage::state();

        $this->assertSame('live', $state['type']);
        $this->assertSame($id, $state['id']);
        $this->assertFalse($state['created']);
        $this->assertStringContainsString('ps_cms_shop', FrakTestDbRecorder::$cmsQueries[0]);
        $this->assertSame('exists', FrakAmbassadorPage::ensure()['status']);
        $this->assertCount(1, CMS::$rows);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
    }

    public function testRestoreReactivatesTheSamePage(): void
    {
        $id = CMS::seed([1 => self::MARKER, 2 => self::MARKER], false);
        FrakConfig::setAmbassadorPageId($id);

        $this->assertSame('restorable', FrakAmbassadorPage::state()['type']);

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('restored', $result['status']);
        $this->assertCount(1, CMS::$rows);
        $this->assertTrue(CMS::$rows[$id]['active']);
        $this->assertSame('live', FrakAmbassadorPage::state()['type']);
    }

    public function testLiveMerchantPageWinsOverARestorableCreatedPage(): void
    {
        $created = CMS::seed([1 => self::MARKER], false);
        FrakConfig::setAmbassadorPageId($created);
        $merchant = CMS::seed([1 => 'Intro {frak_ambassador}']);

        $state = FrakAmbassadorPage::state();

        $this->assertSame('live', $state['type']);
        $this->assertSame($merchant, $state['id']);
        $this->assertFalse(CMS::$rows[$created]['active']);
    }

    public function testDeletedStoredPageIsForgotten(): void
    {
        FrakConfig::setAmbassadorPageId(42);

        $this->assertSame('none', FrakAmbassadorPage::state()['type']);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
        $this->assertFalse(Configuration::hasKey('FRAK_AMBASSADOR_PAGE_ID'));
    }

    public function testStoredPageWithoutTheMarkerIsForgottenAndLeftAlone(): void
    {
        $id = CMS::seed([1 => '<p>Notre page</p>', 2 => '<p>Our page</p>']);
        FrakConfig::setAmbassadorPageId($id);
        $before = CMS::$rows[$id];

        $this->assertSame('none', FrakAmbassadorPage::state()['type']);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
        $this->assertSame($before, CMS::$rows[$id]);
    }

    public function testCreateIsUndoneWhenTheMarkerDoesNotSurviveTheSave(): void
    {
        CMS::$onPersist = static function (array $row): array {
            $row['content'] = array_map(static fn ($html) => '', $row['content']);

            return $row;
        };

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertNotSame('', $result['message']);
        $this->assertSame([], CMS::$rows);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
    }

    public function testRestoreLeavesThePageInactiveWhenTheSaveDoesNotStick(): void
    {
        $id = CMS::seed([1 => self::MARKER, 2 => self::MARKER], false);
        FrakConfig::setAmbassadorPageId($id);
        CMS::$onPersist = static function (array $row): array {
            CMS::$onPersist = null;
            $row['active'] = false;

            return $row;
        };

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertNotSame('', $result['message']);
        $this->assertNull(CMS::$onPersist, 'the seam must have fired once, on the restore write');
        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertSame([], PrestaShopLogger::$logs);
    }

    public function testRestoreRollsTheActivePageBackToInactiveWhenTheMarkerIsStripped(): void
    {
        $id = CMS::seed([1 => self::MARKER, 2 => self::MARKER], false);
        FrakConfig::setAmbassadorPageId($id);
        CMS::$onPersist = static function (array $row): array {
            CMS::$onPersist = null;
            $row['content'] = array_map(static fn ($html) => '', $row['content']);

            return $row;
        };

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertNull(CMS::$onPersist, 'the seam must have fired once, on the restore write');
        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertSame([], PrestaShopLogger::$logs);
    }

    public function testCreateIsUndoneWhenTheMarkerSurvivesInOneLanguageOnly(): void
    {
        CMS::$onPersist = static function (array $row): array {
            $row['content'][2] = '';

            return $row;
        };

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertStringContainsString('marker was removed', $result['message']);
        $this->assertSame([], CMS::$rows);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
    }

    public function testCreateIsUndoneWhenPrestaShopThrowsWhileSaving(): void
    {
        CMS::$onPersistThrows = new PrestaShopException('Duplicate entry');

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertStringStartsWith('PrestaShop could not save the page:', $result['message']);
        $this->assertStringContainsString('Duplicate entry', $result['message']);
        $this->assertSame([], CMS::$rows);
        $this->assertSame(0, FrakConfig::getAmbassadorPageId());
    }

    public function testRestoreFailsWithAMessageWhenPrestaShopKeepsThrowing(): void
    {
        $id = CMS::seed([1 => self::MARKER, 2 => self::MARKER], false);
        FrakConfig::setAmbassadorPageId($id);
        CMS::$onPersistThrows = new PrestaShopException('Invalid field');

        $result = FrakAmbassadorPage::ensure();

        $this->assertSame('failed', $result['status']);
        $this->assertStringStartsWith('PrestaShop could not save the page:', $result['message']);
        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertCount(1, PrestaShopLogger::$logs);
    }

    public function testDisableDoesNotThrowWhenPrestaShopThrowsWhileSaving(): void
    {
        $id = $this->createdPage();
        CMS::$onPersistThrows = new PrestaShopException('Invalid field');

        FrakAmbassadorPage::onDisable();

        $this->assertTrue(CMS::$rows[$id]['active']);
        $this->assertFalse(FrakConfig::isAmbassadorHiddenByDisable());
        $this->assertCount(1, PrestaShopLogger::$logs);
        $this->assertStringContainsString('Invalid field', PrestaShopLogger::$logs[0][0]);
    }

    public function testStylesheetIsRegisteredOnTheStoredPageOnly(): void
    {
        FrakConfig::setAmbassadorPageId(7);

        $this->assertSame([['module-frakintegration-ambassador', 'modules/frakintegration/views/css/ambassador-page.css']], $this->mediaFor(7));
        $this->assertSame([], $this->mediaFor(8));
    }

    public function testStylesheetIsNotRegisteredOutsideTheCmsController(): void
    {
        FrakConfig::setAmbassadorPageId(7);
        $controller = new class () {
            public $cms;

            public array $stylesheets = [];

            public function registerStylesheet($id, $path): void
            {
                $this->stylesheets[] = [$id, $path];
            }
        };
        $controller->cms = (object) ['id' => 7];

        FrakFrontend::setMedia((object) ['controller' => $controller]);

        $this->assertSame([], $controller->stylesheets);
    }

    public function testStylesheetIsNotRegisteredBeforeAPageWasCreated(): void
    {
        $this->assertSame([], $this->mediaFor(0));
    }

    public function testDisableHidesTheLivePageAndEnableRestoresIt(): void
    {
        $id = $this->createdPage();

        FrakAmbassadorPage::onDisable();

        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertTrue(FrakConfig::isAmbassadorHiddenByDisable());

        FrakAmbassadorPage::onEnable();

        $this->assertTrue(CMS::$rows[$id]['active']);
        $this->assertFalse(FrakConfig::isAmbassadorHiddenByDisable());
    }

    public function testEnableLeavesAPageTheMerchantSetInactive(): void
    {
        $id = $this->createdPage();
        CMS::$rows[$id]['active'] = false;

        FrakAmbassadorPage::onDisable();

        $this->assertFalse(FrakConfig::isAmbassadorHiddenByDisable());

        FrakAmbassadorPage::onEnable();

        $this->assertFalse(CMS::$rows[$id]['active']);
    }

    public function testEnableClearsTheFlagAndCreatesNothingWhenThePageWasDeleted(): void
    {
        $id = $this->createdPage();
        FrakAmbassadorPage::onDisable();
        unset(CMS::$rows[$id]);

        FrakAmbassadorPage::onEnable();

        $this->assertFalse(FrakConfig::isAmbassadorHiddenByDisable());
        $this->assertSame([], CMS::$rows);
    }

    public function testUninstallDeactivatesTheCreatedPageAndLeavesTheMerchantPage(): void
    {
        $id = $this->createdPage();
        $merchantId = CMS::seed([1 => '{frak_ambassador}', 2 => '{frak_ambassador}']);

        FrakAmbassadorPage::onDisable();
        FrakAmbassadorPage::onUninstall();

        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertTrue(CMS::$rows[$merchantId]['active']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertFalse(FrakConfig::isAmbassadorHiddenByDisable());
    }

    public function testUninstallDeactivatesTheCreatedPageWithoutTheDisableStep(): void
    {
        $id = $this->createdPage();

        FrakAmbassadorPage::onUninstall();

        $this->assertFalse(CMS::$rows[$id]['active']);
        $this->assertSame($id, FrakConfig::getAmbassadorPageId());
        $this->assertSame([], PrestaShopLogger::$logs);
    }

    public function testUninstallLogsWhenThePageCannotBeDeactivated(): void
    {
        $id = $this->createdPage();
        CMS::$onPersistThrows = new PrestaShopException('Invalid field');

        FrakAmbassadorPage::onUninstall();

        $this->assertTrue(CMS::$rows[$id]['active']);
        $this->assertCount(1, PrestaShopLogger::$logs);
    }

    public function testReinstallDoesNotRepublishTheCreatedPage(): void
    {
        $id = $this->createdPage();
        FrakAmbassadorPage::onDisable();
        FrakAmbassadorPage::onUninstall();

        FrakAmbassadorPage::onEnable();

        $this->assertFalse(CMS::$rows[$id]['active']);
        $state = FrakAmbassadorPage::state();
        $this->assertSame('restorable', $state['type']);
        $this->assertSame($id, $state['id']);
    }

    private function createdPage(): int
    {
        FrakAmbassadorPage::ensure();

        return FrakConfig::getAmbassadorPageId();
    }

    private function mediaFor(int $cmsId): array
    {
        $controller = new CmsController();
        $controller->cms = (object) ['id' => $cmsId];

        FrakFrontend::setMedia((object) ['controller' => $controller]);

        return $controller->stylesheets;
    }
}
