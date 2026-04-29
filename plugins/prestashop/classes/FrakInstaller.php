<?php

/**
 * Install / uninstall orchestration for the Frak PrestaShop module.
 *
 * Owns the hook chain, schema lifecycle (sql/install.php + sql/uninstall.php
 * + Symfony Cache + Lock infrastructure tables via {@see FrakDb}), default
 * seeding, and cron-token provisioning. Symmetric uninstall.
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
        Configuration::updateValue('FRAK_SHOP_NAME', Configuration::get('PS_SHOP_NAME'));
        Configuration::updateValue(
            'FRAK_LOGO_URL',
            $module->context->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO'))
        );

        // Async webhook infrastructure: queue table (raw SQL via
        // sql/install.php) + Symfony Cache + Lock tables (provisioned through
        // their own DBAL adapter `createTable()` calls). Schema must be in
        // place before any order status transition can happen, otherwise
        // enqueue() / merchant resolution / the cron URL would silently
        // fail.
        // `$sql` is populated by the included file. Declared here so phpstan
        // can see the contract across the include boundary.
        $sql = [];
        include $module->getLocalPath() . 'sql/install.php';
        foreach ($sql as $query) {
            if (!Db::getInstance()->execute($query)) {
                return false;
            }
        }
        FrakDb::createInfrastructureTables();

        // The cron token gates the front controller via `hash_equals`;
        // rotating it would break any merchant cron job already wired against
        // the displayed URL, so the value is generated only when missing —
        // keeps re-installs after a partial uninstall safe.
        if ((string) Configuration::get('FRAK_CRON_TOKEN') === '') {
            Configuration::updateValue('FRAK_CRON_TOKEN', bin2hex(random_bytes(32)));
        }

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

        Configuration::deleteByName('FRAK_SHOP_NAME');
        Configuration::deleteByName('FRAK_LOGO_URL');
        Configuration::deleteByName('FRAK_WEBHOOK_SECRET');
        Configuration::deleteByName('FRAK_SETTINGS_VERSION');
        Configuration::deleteByName('FRAK_CRON_TOKEN');
        FrakPlacementRegistry::clearAll();

        // Schema teardown: webhook queue via sql/uninstall.php, Symfony Cache
        // + Lock tables via FrakDb. SQL errors are swallowed: uninstall is
        // best-effort and PrestaShop already truncated `ps_hook_module` via
        // `parent::uninstall()` regardless.
        $sql = [];
        include $module->getLocalPath() . 'sql/uninstall.php';
        foreach ($sql as $query) {
            Db::getInstance()->execute($query);
        }
        FrakDb::dropInfrastructureTables();

        return true;
    }
}
