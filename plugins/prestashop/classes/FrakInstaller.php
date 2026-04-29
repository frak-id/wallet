<?php

/**
 * Install / uninstall orchestration for the Frak PrestaShop module.
 *
 * Owns the hook chain, schema lifecycle (sql/install.php + sql/uninstall.php
 * — webhook queue + key/value cache table), default seeding, and cron-token
 * provisioning. Symmetric uninstall.
 *
 * Extracted from `FrakIntegration::install()` / `uninstall()` so the Module
 * bootstrap stays a thin router. Mirrors the WordPress sibling's split
 * between the entry-point file and `class-frak-plugin.php`'s boot sequence.
 */
class FrakInstaller
{
    /**
     * Always-on plumbing hooks. Display hooks are owned by
     * {@see FrakPlacementRegistry::distinctHooks()} and merged in below so
     * the install / uninstall / upgrade chains stay in lock-step (one place
     * to add or remove a hook).
     *
     * - `actionFrontControllerSetMedia`: SDK script + JS def injection.
     *   Replaces the legacy `header` hook + raw `<script>` tag in `head.tpl`
     *   so the SDK goes through PrestaShop's native asset manager (CCC-aware,
     *   deduped across modules, defer-attribute capable). Mirrors the
     *   WordPress sibling's `wp_enqueue_script(..., strategy:defer,
     *   in_footer:true)` pattern.
     * - `header`: minimal — emits resource hints (DNS-prefetch / preconnect)
     *   and the inline FrakSetup config block. Resource hints MUST live in
     *   `<head>` to be effective.
     * - `actionOrderStatusPostUpdate`: post-commit order status webhook
     *   trigger. Pre-commit `actionOrderStatusUpdate` raced under multistore
     *   / high load (PrestaShop docs explicitly recommend post-commit).
     * - `actionOrderSlipAdd`: credit-slip (refund) webhook trigger. Fires on
     *   every `OrderSlip` creation — full refunds, partial refunds, and
     *   standard returns. Aligns the plugin with WC / Magento siblings'
     *   "any refund voids attribution" rule, since `actionOrderStatusPost
     *   Update` does NOT fire on partial refunds (the order keeps its
     *   pre-refund status, only the credit slip is created).
     * - `actionCronJob`: opt-in auto-registration with the `ps_cronjobs`
     *   module. When `ps_cronjobs` is installed, it discovers modules
     *   registered to this hook via `Hook::getHookModuleExecList('actionCronJob')`,
     *   adds them to its cron table using each module's `getCronFrequency()`,
     *   and invokes `hookActionCronJob()` on its own tick. The hook is a
     *   no-op when `ps_cronjobs` is absent — the URL-token cron controller
     *   keeps working for merchants on plain server cron, so this is purely
     *   additive (no copy/paste required when `ps_cronjobs` is installed).
     */
    private const CORE_HOOKS = [
        'header',
        'actionFrontControllerSetMedia',
        'actionOrderStatusPostUpdate',
        'actionOrderSlipAdd',
        'actionCronJob',
    ];

    /**
     * Run the install chain on behalf of {@see FrakIntegration::install()}.
     *
     * Caller is responsible for invoking `parent::install()` first so the
     * `ps_module` row exists before any hook registration runs.
     *
     * @param Module $module The FrakIntegration instance.
     */
    public static function install(Module $module): bool
    {
        // Fail fast if PrestaShop's bundled Symfony HttpClient is not
        // loadable. The merchant zip no longer requires `symfony/http-client`
        // (CHANGELOG: "shared-hosting diet") and we rely on PS 8.1+ shipping
        // it via `symfony/symfony` 4.x. Surfacing the error here means a
        // misconfigured PS install rejects the module at upload time instead
        // of silently failing on the first webhook fire.
        if (!FrakHttpClient::isAvailable()) {
            $module->_errors[] = FrakHttpClient::missingDependencyMessage();
            return false;
        }

        // Always-on plumbing hooks (CORE_HOOKS) plus every placement-driven
        // display hook from `FrakPlacementRegistry::distinctHooks()`. One loop
        // = one place to add/remove a hook on the install path — keeps the
        // install / uninstall / upgrade chains in lock-step.
        foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
            if (!$module->registerHook($hook)) {
                return false;
            }
        }

        // Seed sane defaults from the PrestaShop shop record. Anything else
        // (i18n, modal language, share-button copy/style) is now resolved by
        // the SDK against business.frak.id once the merchant is registered.
        FrakConfig::setShopName((string) Configuration::get('PS_SHOP_NAME'));
        // `Module::$context` is `protected`, so reach it through the global
        // singleton instead of `$module->context`. Both point at the same
        // request-scoped instance; the protected accessor only exists for
        // subclasses to share state with their hook handlers.
        FrakConfig::setLogoUrl(
            Context::getContext()->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO'))
        );

        // Async webhook infrastructure: queue table + key/value cache table.
        // `sql/install.php` provisions both via `CREATE TABLE IF NOT EXISTS`.
        // Schema must be in place before any order status transition can
        // happen, otherwise enqueue() / merchant resolution / the cron URL
        // would silently fail.
        // `$sql` is populated by the included file. Declared here so phpstan
        // can see the contract across the include boundary.
        $sql = [];
        include $module->getLocalPath() . 'sql/install.php';
        foreach ($sql as $query) {
            if (!Db::getInstance()->execute($query)) {
                return false;
            }
        }

        // The cron token gates the front controller via `hash_equals`;
        // rotating would break any merchant cron job already wired against
        // the displayed URL, so {@see FrakConfig::ensureCronToken()} only
        // generates a fresh token when one isn't configured — keeps
        // re-installs after a partial uninstall safe.
        FrakConfig::ensureCronToken();

        // Seed the bundled placements row with each placement's declared
        // default. Opt-out for the legacy product / order surfaces, opt-in
        // for the new auxiliary surfaces — keeps existing storefronts
        // visually unchanged on upgrade.
        FrakPlacementRegistry::seedDefaults();

        return true;
    }

    /**
     * Run the uninstall chain on behalf of {@see FrakIntegration::uninstall()}.
     *
     * Caller is responsible for invoking `parent::uninstall()` first.
     *
     * @param Module $module The FrakIntegration instance.
     */
    public static function uninstall(Module $module): bool
    {
        // Symmetric with install(); `parent::uninstall()` already truncates
        // the module's `ps_hook_module` rows but the explicit chain keeps test
        // teardown deterministic and surfaces failures clearly.
        foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
            if (!$module->unregisterHook($hook)) {
                return false;
            }
        }

        Configuration::deleteByName(FrakConfig::SHOP_NAME);
        Configuration::deleteByName(FrakConfig::LOGO_URL);
        Configuration::deleteByName(FrakConfig::WEBHOOK_SECRET);
        Configuration::deleteByName('FRAK_SETTINGS_VERSION');
        Configuration::deleteByName(FrakConfig::CRON_TOKEN);
        FrakPlacementRegistry::clearAll();

        // Schema teardown: webhook queue + cache table via sql/uninstall.php.
        // SQL errors are swallowed: uninstall is best-effort and PrestaShop
        // already truncated `ps_hook_module` via `parent::uninstall()`
        // regardless.
        $sql = [];
        include $module->getLocalPath() . 'sql/uninstall.php';
        foreach ($sql as $query) {
            Db::getInstance()->execute($query);
        }

        return true;
    }

    /**
     * Idempotent admin-Tab registration. Skips when a row already exists
     * (partial-install retry) so re-running install() never duplicates the
     * sidebar entry. Sits under Modules so the operational tooling (queue
     * health, drain queue, refresh merchant) is one click away for daily
     * ops, and gates per-employee access via PrestaShop's standard
     * Permissions panel.
     *
     * Shared by {@see install()} and `upgrade/install-1.0.1.php` so fresh
     * installs and v0.0.4 → v1.0.1 upgrades both end up with the same Tab
     * row.
     */
    public static function registerTab(Module $module): bool
    {
        if ((int) Tab::getIdFromClassName('AdminFrakIntegration') !== 0) {
            return true;
        }
        $tab = new Tab();
        $tab->active = 1;
        $tab->class_name = 'AdminFrakIntegration';
        $tab->name = [];
        foreach (Language::getLanguages(true) as $lang) {
            $tab->name[$lang['id_lang']] = $module->l('Frak');
        }
        $tab->id_parent = (int) Tab::getIdFromClassName('AdminParentModulesSf');
        $tab->module = $module->name;
        return (bool) $tab->add();
    }

    /**
     * Symmetric Tab teardown. Best-effort — a missing or already-deleted
     * row is treated as success so a partially-installed module can still
     * uninstall cleanly.
     */
    public static function unregisterTab(): bool
    {
        $id_tab = (int) Tab::getIdFromClassName('AdminFrakIntegration');
        if ($id_tab === 0) {
            return true;
        }
        $tab = new Tab($id_tab);
        return (bool) $tab->delete();
    }
}
