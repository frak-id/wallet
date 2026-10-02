<?php

/**
 * Ambassador page model: which CMS page holds the ambassador component, and
 * the create / restore behind the Settings action.
 *
 * The page the module created is tracked by `FRAK_AMBASSADOR_PAGE_ID`; a page
 * the merchant built with the marker is only ever found, never touched.
 */
class FrakAmbassadorPage
{
    /** What the display-time swap looks for; attributes may follow it. */
    private const MARKER = '{frak_ambassador';

    /** Content of a created page, in every language. */
    private const BODY = '{frak_ambassador}';

    /** CMS category "Home". */
    private const HOME_CATEGORY = 1;

    /**
     * Where the ambassador page stands, as Settings shows it.
     *
     *   - live: an active page holds the marker; `created` tells the page the
     *     module made from one the merchant built.
     *   - restorable: the created page holds the marker but is inactive.
     *   - none: neither.
     *
     * @return array{type: 'none'}|array{type: 'live'|'restorable', id: int, created: bool, title: string, url: string, editUrl: string}
     */
    public static function state(): array
    {
        $stored = self::storedPage();
        if ($stored !== null && $stored->active) {
            return self::describe('live', $stored, true);
        }

        $foundId = self::findMerchantPageId();
        if ($foundId > 0) {
            return self::describe('live', new CMS($foundId), false);
        }

        return $stored !== null ? self::describe('restorable', $stored, true) : ['type' => 'none'];
    }

    /**
     * Make sure an active ambassador page exists: report a known one, restore
     * the created one, or create a new one. Writes are read back and undone
     * on a mismatch.
     *
     * @return array{status: 'exists'|'restored'|'created'}|array{status: 'failed', message: string}
     */
    public static function ensure(): array
    {
        $state = self::state();
        if ($state['type'] === 'live') {
            return ['status' => 'exists'];
        }

        return $state['type'] === 'restorable' ? self::restore($state['id']) : self::create();
    }

    /** Module disabled: set the created page inactive when it was live, and remember it was this step. */
    public static function onDisable(): void
    {
        $cms = self::storedPage();
        if ($cms !== null && $cms->active && self::setActive($cms, false)) {
            FrakConfig::setAmbassadorHiddenByDisable();
        }
    }

    /** Module enabled: republish the created page only when {@see onDisable()} was what hid it. */
    public static function onEnable(): void
    {
        if (!FrakConfig::isAmbassadorHiddenByDisable()) {
            return;
        }

        $cms = self::storedPage();
        if ($cms === null || self::setActive($cms, true)) {
            FrakConfig::clearAmbassadorHiddenByDisable();
        }
    }

    /** Module uninstalled: leave the created page inactive and in Design → Pages; keep its id for a reinstall. */
    public static function onUninstall(): void
    {
        $cms = self::storedPage();
        if ($cms !== null && $cms->active) {
            self::setActive($cms, false);
        }
        FrakConfig::clearAmbassadorHiddenByDisable();
    }

    private static function setActive(CMS $cms, bool $active): bool
    {
        $cms->active = (int) $active;
        $reason = self::save($cms, false);
        if ($reason !== '') {
            PrestaShopLogger::addLog('[FrakSDK] could not set the ambassador page ' . (int) $cms->id . ($active ? ' active: ' : ' inactive: ') . $reason, 3);
        }

        return $reason === '';
    }

    /** The created page, or null. Forgets the id when the page is gone or lost its marker. */
    private static function storedPage(): ?CMS
    {
        $id = FrakConfig::getAmbassadorPageId();
        if ($id <= 0) {
            return null;
        }

        $cms = new CMS($id);
        if ((int) $cms->id > 0 && self::holdsMarker($cms)) {
            return $cms;
        }

        FrakConfig::clearAmbassadorPageId();

        return null;
    }

    private static function holdsMarker(CMS $cms): bool
    {
        foreach ((array) $cms->content as $html) {
            if (strpos((string) $html, self::MARKER) !== false) {
                return true;
            }
        }

        return false;
    }

    /** Newest active page of the current shop whose content holds the marker. `getValue()` appends `LIMIT 1`. */
    private static function findMerchantPageId(): int
    {
        $shopId = (int) Context::getContext()->shop->id;

        return (int) Db::getInstance()->getValue(
            'SELECT c.`id_cms` FROM `' . _DB_PREFIX_ . 'cms` c'
            . ' INNER JOIN `' . _DB_PREFIX_ . 'cms_shop` cs ON cs.`id_cms` = c.`id_cms` AND cs.`id_shop` = ' . $shopId
            . ' INNER JOIN `' . _DB_PREFIX_ . 'cms_lang` cl ON cl.`id_cms` = c.`id_cms` AND cl.`id_shop` = cs.`id_shop`'
            . ' WHERE c.`active` = 1 AND cl.`content` LIKE \'%' . pSQL(self::MARKER) . '%\''
            . ' ORDER BY c.`id_cms` DESC'
        );
    }

    /**
     * @param 'live'|'restorable' $type
     * @return array{type: 'live'|'restorable', id: int, created: bool, title: string, url: string, editUrl: string}
     */
    private static function describe(string $type, CMS $cms, bool $created): array
    {
        $context = Context::getContext();
        $langId = (int) $context->language->id;
        $titles = array_filter((array) $cms->meta_title, 'strlen');

        return [
            'type' => $type,
            'id' => (int) $cms->id,
            'created' => $created,
            'title' => (string) ($titles[$langId] ?? reset($titles)),
            'url' => $context->link->getCMSLink($cms, null, null, $langId),
            'editUrl' => $context->link->getAdminLink(
                'AdminCmsContent',
                true,
                [],
                ['updatecms' => 1, 'id_cms' => (int) $cms->id]
            ),
        ];
    }

    /** @return array{status: 'restored'}|array{status: 'failed', message: string} */
    private static function restore(int $id): array
    {
        $cms = new CMS($id);
        $cms->active = 1;
        $reason = self::save($cms, false) ?: self::verify($id, false);
        if ($reason !== '') {
            self::setActive(new CMS($id), false);

            return self::failure($reason);
        }

        return ['status' => 'restored'];
    }

    /** @return array{status: 'created'}|array{status: 'failed', message: string} */
    private static function create(): array
    {
        $cms = new CMS();
        $cms->id_cms_category = self::HOME_CATEGORY;
        $cms->active = 1;
        $cms->indexation = 1;
        $titles = [];
        $rewrites = [];
        $content = [];
        foreach (Language::getLanguages(true) as $lang) {
            $langId = (int) $lang['id_lang'];
            $titles[$langId] = $lang['iso_code'] === 'fr' ? 'Devenir ambassadeur' : 'Become an ambassador';
            $rewrites[$langId] = Tools::str2url($titles[$langId]);
            $content[$langId] = self::BODY;
        }
        $cms->meta_title = $titles;
        $cms->link_rewrite = $rewrites;
        $cms->content = $content;

        $reason = self::save($cms, true) ?: self::verify((int) $cms->id, true);
        if ($reason !== '') {
            if ((int) $cms->id > 0) {
                $cms->delete();
            }

            return self::failure($reason);
        }

        FrakConfig::setAmbassadorPageId((int) $cms->id);

        return ['status' => 'created'];
    }

    /** Empty string when saved, else the reason it was not. */
    private static function save(CMS $cms, bool $new): string
    {
        try {
            $saved = $new ? $cms->add() : $cms->update();
        } catch (Exception $e) {
            return 'PrestaShop could not save the page: ' . $e->getMessage();
        }

        return $saved ? '' : 'PrestaShop could not save the page.';
    }

    /**
     * Read the page back. Empty string when it is active and holds the marker
     * (in every active language when `$everyLanguage`), else the reason.
     */
    private static function verify(int $id, bool $everyLanguage): string
    {
        $cms = new CMS($id);
        if ((int) $cms->id <= 0) {
            return 'The page could not be read back after saving.';
        }
        if (!$cms->active) {
            return 'The page was saved as inactive, probably by another module.';
        }

        $holds = self::holdsMarker($cms);
        $content = (array) $cms->content;
        foreach ($everyLanguage ? Language::getLanguages(true) : [] as $lang) {
            $holds = $holds && strpos((string) ($content[(int) $lang['id_lang']] ?? ''), self::MARKER) !== false;
        }

        return $holds ? '' : 'The ambassador marker was removed from the page while saving, probably by another module.';
    }

    /** @return array{status: 'failed', message: string} */
    private static function failure(string $reason): array
    {
        return ['status' => 'failed', 'message' => $reason];
    }
}
