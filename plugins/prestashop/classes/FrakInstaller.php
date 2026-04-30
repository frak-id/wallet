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
     * `ps_module` row exists before any hook registration runs. The caller
     * SHOULD also invoke {@see cleanLeftovers()} BEFORE `parent::install()`
     * to nuke debris from any prior failed install — without that, a fresh
     * `parent::install()` can fail with a 1062 duplicate-key error on
     * `authorization_role.slug` (PrestaShop core's `ModuleTabRegister`
     * inserts those rows but never removes them on uninstall).
     *
     * Steps run best-effort: every failure is logged, but the next steps
     * still run so the merchant ends up in a fully-installed state even
     * when one sub-step trips. Aggregate `$ok` reflects whether ALL steps
     * succeeded.
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
        //
        // `Module::$_errors` is `protected` so we can't push the message to
        // the merchant-facing install error dump from this static helper
        // (`FrakInstaller` is not a Module subclass) — same visibility
        // constraint as `Module::$context` documented below. Surface the
        // diagnostic via the standard PS log instead; merchants get a
        // generic install failure in Module Manager and the actionable
        // root cause in Advanced Parameters → Logs (consistent with the
        // rest of the plugin's webhook + cron error UX).
        if (!FrakHttpClient::isAvailable()) {
            PrestaShopLogger::addLog('[FrakSDK] ' . FrakHttpClient::missingDependencyMessage(), 3);
            return false;
        }

        // Best-effort install chain. Each step runs regardless of prior
        // failures so a single hook-registration hiccup doesn't leave the
        // schema unprovisioned or the cron token un-seeded. Aggregate `$ok`
        // returned at the end so PrestaShop's Module Manager still surfaces
        // a red error dot if anything went wrong.
        $ok = true;
        foreach (
            [
            // Always-on plumbing hooks (CORE_HOOKS) plus every placement-driven
            // display hook from `FrakPlacementRegistry::distinctHooks()`. One
            // loop = one place to add/remove a hook on the install path —
            // keeps the install / uninstall / upgrade chains in lock-step.
            'register hooks' => static function () use ($module): bool {
                $hookOk = true;
                foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
                    if (!$module->registerHook($hook)) {
                        PrestaShopLogger::addLog('[FrakSDK] registerHook failed: ' . $hook, 3);
                        $hookOk = false;
                    }
                }
                return $hookOk;
            },
            // Seed sane defaults from the PrestaShop shop record. Anything else
            // (i18n, modal language, share-button copy/style) is now resolved by
            // the SDK against business.frak.id once the merchant is registered.
            'seed brand defaults' => static function (): bool {
                FrakConfig::setShopName((string) Configuration::get('PS_SHOP_NAME'));
            // `Module::$context` is `protected`, so reach it through the global
            // singleton instead of `$module->context`. Both point at the same
            // request-scoped instance; the protected accessor only exists for
            // subclasses to share state with their hook handlers.
                FrakConfig::setLogoUrl(
                    Context::getContext()->link->getMediaLink(_PS_IMG_ . Configuration::get('PS_LOGO'))
                );
                return true;
            },
            // Async webhook infrastructure: queue table + key/value cache table.
            // `sql/install.php` provisions both via `CREATE TABLE IF NOT EXISTS`.
            // Schema must be in place before any order status transition can
            // happen, otherwise enqueue() / merchant resolution / the cron URL
            // would silently fail.
            'install schema' => static function () use ($module): bool {
                $sql = [];
                include $module->getLocalPath() . 'sql/install.php';
                $schemaOk = true;
                foreach ($sql as $query) {
                    if (!Db::getInstance()->execute($query)) {
                        PrestaShopLogger::addLog('[FrakSDK] sql/install.php query failed', 3);
                        $schemaOk = false;
                    }
                }
                return $schemaOk;
            },
            // The cron token gates the front controller via `hash_equals`;
            // rotating would break any merchant cron job already wired against
            // the displayed URL, so {@see FrakConfig::ensureCronToken()} only
            // generates a fresh token when one isn't configured — keeps
            // re-installs after a partial uninstall safe.
            'ensure cron token' => static function (): bool {
                FrakConfig::ensureCronToken();
                return true;
            },
            // Seed the bundled placements row with each placement's declared
            // default. Opt-out for the legacy product / order surfaces, opt-in
            // for the new auxiliary surfaces — keeps existing storefronts
            // visually unchanged on upgrade.
            'seed placement defaults' => static function (): bool {
                FrakPlacementRegistry::seedDefaults();
                return true;
            },
            ] as $label => $step
        ) {
            try {
                $ok = $step() && $ok;
            } catch (\Throwable $e) {
                PrestaShopLogger::addLog('[FrakSDK] install step "' . $label . '" failed: ' . $e->getMessage(), 3);
                $ok = false;
            }
        }

        return $ok;
    }

    /**
     * Run the uninstall chain on behalf of {@see FrakIntegration::uninstall()}.
     *
     * Caller is responsible for invoking `parent::uninstall()` first.
     *
     * Steps run best-effort: PrestaShop core's `parent::uninstall()` returns
     * `false` on the first failed sub-step and leaves everything after it
     * untouched, which is exactly what produces the half-uninstalled state
     * that blocks re-install with a 1062 duplicate-key error on
     * `authorization_role.slug`. Wrapping each step in its own try/catch +
     * accumulating into `$ok` keeps the cleanup chain marching to the end
     * regardless of partial failures.
     *
     * @param Module $module The FrakIntegration instance.
     */
    public static function uninstall(Module $module): bool
    {
        $ok = true;
        foreach (
            [
            // Symmetric with install(); `parent::uninstall()` already truncates
            // the module's `ps_hook_module` rows but the explicit chain keeps
            // test teardown deterministic and surfaces failures clearly.
            'unregister hooks' => static function () use ($module): bool {
                $hookOk = true;
                foreach (array_merge(self::CORE_HOOKS, FrakPlacementRegistry::distinctHooks()) as $hook) {
                    if (!$module->unregisterHook($hook)) {
                        $hookOk = false;
                    }
                }
                return $hookOk;
            },
            'delete configuration rows' => static function (): bool {
                Configuration::deleteByName(FrakConfig::SHOP_NAME);
                Configuration::deleteByName(FrakConfig::LOGO_URL);
                Configuration::deleteByName(FrakConfig::WEBHOOK_SECRET);
                Configuration::deleteByName('FRAK_SETTINGS_VERSION');
                Configuration::deleteByName(FrakConfig::CRON_TOKEN);
                FrakPlacementRegistry::clearAll();
                return true;
            },
            // Schema teardown: webhook queue + cache table via sql/uninstall.php.
            // SQL errors are swallowed: uninstall is best-effort and PrestaShop
            // already truncated `ps_hook_module` via `parent::uninstall()`
            // regardless.
            'drop schema' => static function () use ($module): bool {
                $sql = [];
                include $module->getLocalPath() . 'sql/uninstall.php';
                foreach ($sql as $query) {
                    Db::getInstance()->execute($query);
                }
                return true;
            },
            ] as $label => $step
        ) {
            try {
                $ok = $step() && $ok;
            } catch (\Throwable $e) {
                PrestaShopLogger::addLog('[FrakSDK] uninstall step "' . $label . '" failed: ' . $e->getMessage(), 3);
                $ok = false;
            }
        }

        return $ok;
    }

    /**
     * Best-effort scrub of every row this module is known to leave behind.
     *
     * Called from THREE entry points:
     *   - {@see FrakIntegration::install()} BEFORE `parent::install()` —
     *     repairs partial-install state from a prior failed attempt so
     *     `parent::install()` can re-insert without tripping a 1062 on
     *     `authorization_role.slug`, `tab.class_name`, or `module.name`.
     *   - {@see FrakIntegration::uninstall()} AFTER `parent::uninstall()` —
     *     belt-and-suspenders for the case where `parent::uninstall()` (or
     *     the explicit chain in {@see uninstall()}) fails halfway and the
     *     merchant doesn't immediately retry.
     *   - `upgrade/install-X.Y.Z.php` upgrade scripts that touch tabs or
     *     auth roles (e.g. 1.0.1's step 9 `registerTab()`). PrestaShop's
     *     `runUpgradeModule()` NEVER enters `install()`, so a half-uninstalled
     *     DB carries orphan `authorization_role` rows straight into the
     *     upgrade and trips a 1062 on `Tab::add()`. Upgrade scripts MUST
     *     pass `keep_module_row=true` — see option docs below.
     *
     * Order matters: child rows (FK'd to `id_module` / `id_tab` /
     * `id_authorization_role`) are deleted BEFORE their parent rows so the
     * joins still resolve. `ps_module` is the very last delete (skipped
     * when `keep_module_row=true`).
     *
     * Schema tables (`frak_webhook_queue`, `frak_cache`) are NOT dropped
     * here — only `uninstall()` proper does that, so a partial-install
     * retry doesn't lose in-flight webhook deliveries.
     *
     * Each step is wrapped in its own try/catch so a single failing query
     * doesn't strand the rest of the cleanup. Failures are logged via
     * `PrestaShopLogger` (severity 3 = error, surfaces in Advanced
     * Parameters → Logs, matches the rest of the plugin's error UX).
     *
     * @param Module                        $module The FrakIntegration instance.
     * @param array{keep_module_row?: bool}  $opts
     *   - `keep_module_row` (default `false`): preserve the merchant-facing
     *     state required to leave a working module behind on the upgrade
     *     path. Skips THREE deletes:
     *       - `ps_module` row — deleting mid-upgrade detaches the module
     *         from `Module::runUpgradeModule()`'s controller (which keys on
     *         the row) and breaks every step after this one.
     *       - `ps_module_shop` row — PrestaShop's `Module::isEnabled()`
     *         JOINs through `module_shop`, so deleting it disables the
     *         module per-shop in BO even though `ps_module.active=1`.
     *       - `ps_configuration` rows — wiping `FRAK_WEBHOOK_SECRET` /
     *         `FRAK_CRON_TOKEN` / `FRAK_PLACEMENTS` would force the merchant
     *         to re-paste their secret from `business.frak.id`, re-wire
     *         their cron URL (regenerated tokens break already-deployed
     *         crons), and lose every customised placement toggle.
     *     The orphan-row scrub of `hook_module` / `access` / `module_access`
     *     / `authorization_role` / `tab` / `tab_lang` still runs because
     *     the upgrade chain re-creates those (registerHook + registerTab
     *     + ensureModuleAccessRoles).
     */
    public static function cleanLeftovers(Module $module, array $opts = []): bool
    {
        $db = Db::getInstance();
        $name = pSQL($module->name);
        // PrestaShop core uppercases module names in `authorization_role.slug`
        // for BOTH module-level access (`ROLE_MOD_MODULE_FRAKINTEGRATION_*`)
        // AND tab-level access (`ROLE_MOD_TAB_ADMINFRAKINTEGRATION_*`). Both
        // root in the uppercased module name, so a single LIKE pattern
        // catches all of them — the tab-level slugs need to go too,
        // otherwise `Tab::add()` (called from `registerTab()` and from
        // PrestaShop's `ModuleTabRegister`) trips 1062 when re-inserting.
        $slugLike = pSQL('%' . strtoupper($module->name) . '%');
        $prefix = _DB_PREFIX_;
        $keepModuleRow = !empty($opts['keep_module_row']);
        $ok = true;

        foreach (
            [
            // 1. Hook registrations. Removed first because the join via
            //    `id_module` survives until we delete the parent `module` row.
            'hook_module' => static function () use ($db, $prefix, $name): bool {
                return (bool) $db->execute(
                    'DELETE hm FROM `' . $prefix . 'hook_module` hm'
                    . ' INNER JOIN `' . $prefix . 'module` m ON m.id_module = hm.id_module'
                    . " WHERE m.name = '" . $name . "'"
                );
            },
            // 2. Authorization roles + access — the source of the 1062 error
            //    on re-install. PrestaShop's `ModuleTabRegister::addTabs()`
            //    inserts these rows when `$this->tabs` is declared, but core
            //    NEVER removes them on uninstall (see PrestaShop core gap).
            //    Children (`access`) deleted before parent (`authorization_role`).
            'access' => static function () use ($db, $prefix, $slugLike): bool {
                return (bool) $db->execute(
                    'DELETE a FROM `' . $prefix . 'access` a'
                    . ' INNER JOIN `' . $prefix . 'authorization_role` ar'
                    . ' ON ar.id_authorization_role = a.id_authorization_role'
                    . " WHERE ar.slug LIKE '" . $slugLike . "'"
                );
            },
            'module_access' => static function () use ($db, $prefix, $slugLike): bool {
                return (bool) $db->execute(
                    'DELETE ma FROM `' . $prefix . 'module_access` ma'
                    . ' INNER JOIN `' . $prefix . 'authorization_role` ar'
                    . ' ON ar.id_authorization_role = ma.id_authorization_role'
                    . " WHERE ar.slug LIKE '" . $slugLike . "'"
                );
            },
            'authorization_role' => static function () use ($db, $prefix, $slugLike): bool {
                return (bool) $db->execute(
                    'DELETE FROM `' . $prefix . 'authorization_role`'
                    . " WHERE slug LIKE '" . $slugLike . "'"
                );
            },
            // 3. Module ↔ shop link (multistore-aware: PrestaShop writes one
            //    row per shop the module is enabled on). Skipped on the
            //    upgrade path: PrestaShop's `Module::isEnabled()` JOINs
            //    through `module_shop`, so deleting it disables the module
            //    per-shop in BO even though `ps_module.active` stays 1.
            //    Only the install/uninstall paths (which run
            //    `parent::install()` / `parent::uninstall()`) re-create or
            //    truly cleanup the row.
            'module_shop' => static function () use ($db, $prefix, $name, $keepModuleRow): bool {
                if ($keepModuleRow) {
                    return true;
                }
                return (bool) $db->execute(
                    'DELETE ms FROM `' . $prefix . 'module_shop` ms'
                    . ' INNER JOIN `' . $prefix . 'module` m ON m.id_module = ms.id_module'
                    . " WHERE m.name = '" . $name . "'"
                );
            },
            // 4. Admin tabs. `tab_lang` (FK on `id_tab`) deleted before `tab`.
            //    PrestaShop's auto-tab-register reinserts these on the next
            //    `parent::install()` from `$this->tabs`, so removing here is
            //    safe even when re-installing immediately.
            'tab_lang' => static function () use ($db, $prefix, $name): bool {
                return (bool) $db->execute(
                    'DELETE tl FROM `' . $prefix . 'tab_lang` tl'
                    . ' INNER JOIN `' . $prefix . 'tab` t ON t.id_tab = tl.id_tab'
                    . " WHERE t.module = '" . $name . "'"
                );
            },
            'tab' => static function () use ($db, $prefix, $name): bool {
                return (bool) $db->execute(
                    'DELETE FROM `' . $prefix . "tab` WHERE module = '" . $name . "'"
                );
            },
            // 5. Module-owned configuration rows. Enumerated via `FrakConfig`
            //    constants instead of `LIKE 'FRAK_%'` to avoid colliding with
            //    third-party rows that may share the prefix in the future.
            //    `FrakPlacementRegistry::clearAll()` covers both the bundled
            //    `FRAK_PLACEMENTS` row AND the legacy per-placement rows from
            //    pre-1.0.1 dev installs.
            //
            //    Skipped on the upgrade path: wiping `FRAK_WEBHOOK_SECRET` /
            //    `FRAK_CRON_TOKEN` / `FRAK_PLACEMENTS` would force the
            //    merchant to re-paste their secret + re-wire their cron URL
            //    + lose every customised placement toggle. Upgrade scripts
            //    rely on the per-step idempotent re-seed (`ensureCronToken`,
            //    `seedDefaults`) which preserves existing values.
            'configuration' => static function () use ($keepModuleRow): bool {
                if ($keepModuleRow) {
                    return true;
                }
                Configuration::deleteByName(FrakConfig::SHOP_NAME);
                Configuration::deleteByName(FrakConfig::LOGO_URL);
                Configuration::deleteByName(FrakConfig::WEBHOOK_SECRET);
                Configuration::deleteByName(FrakConfig::CRON_TOKEN);
                Configuration::deleteByName('FRAK_SETTINGS_VERSION');
                FrakPlacementRegistry::clearAll();
                return true;
            },
            // 6. `ps_module` LAST — every join above resolves through it.
            //    Skipped when `keep_module_row=true` (upgrade-path callers):
            //    deleting the row mid-upgrade detaches the module from
            //    `runUpgradeModule()`'s controller and breaks the rest of
            //    the script. The orphan child-row scrub above is exactly
            //    what the upgrade path needs anyway — the module row itself
            //    is healthy.
            'module' => static function () use ($db, $prefix, $name, $keepModuleRow): bool {
                if ($keepModuleRow) {
                    return true;
                }
                return (bool) $db->execute(
                    'DELETE FROM `' . $prefix . "module` WHERE name = '" . $name . "'"
                );
            },
            // 7. Cache invalidation. PrestaShop's `Tab::getIdFromClassName()`,
            //    `Module::isInstalled()`, and the hook lookups all cache their
            //    DB results in the in-process `Cache` singleton (see core's
            //    `Tab::getIdFromClassName` which keys on
            //    `Tab::getIdFromClassName_{class_name}`). Without invalidation,
            //    a same-request caller AFTER cleanLeftovers() — e.g. step 9
            //    `registerTab()` in the upgrade chain — reads the stale
            //    pre-DELETE id, short-circuits its own existence check, and
            //    silently no-ops the insert. Net effect: 1.0.3-versioned
            //    install with no `ps_tab` row, no admin sidebar entry, no
            //    way to reach the config page. Wipe the cache prefixes here
            //    so every downstream lookup hits the fresh post-cleanup DB.
            'cache invalidation' => static function (): bool {
                // Trailing `*` triggers prefix-match in PrestaShop's
                // `Cache::clean()` (see core's `Cache::clean()`); without it,
                // exact-match would never hit `Module::isInstalled{name}` /
                // `Module::getModuleIdByName_{name}` since those keys are
                // suffixed with the module name verbatim.
                Cache::clean('Tab::getIdFromClassName_*');
                Cache::clean('Module::isInstalled*');
                Cache::clean('Module::getModuleIdByName_*');
                Cache::clean('Module::isEnabled*');
                Cache::clean('hook_*');
                return true;
            },
            ] as $label => $step
        ) {
            try {
                $ok = $step() && $ok;
            } catch (\Throwable $e) {
                PrestaShopLogger::addLog('[FrakSDK] cleanLeftovers step "' . $label . '" failed: ' . $e->getMessage(), 3);
                $ok = false;
            }
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
     *
     * The existence check goes through a direct `SELECT` instead of
     * `Tab::getIdFromClassName()` because the latter caches results in
     * PrestaShop's in-process `Cache` singleton. When this method is called
     * AFTER {@see cleanLeftovers()} in the same request (the upgrade-path
     * sequence: `cleanLeftovers()` deletes `ps_tab` → step 9 calls
     * `registerTab()`), the cached pre-DELETE id triggers an early return,
     * no insert ever fires, no log line lands, and the upgrade reports
     * success with no admin tab. Two layers of defense: this direct query
     * survives a stale cache, AND `cleanLeftovers()` invalidates the cache
     * prefix at the end of its run — belt-and-suspenders.
     */
    public static function registerTab(Module $module): bool
    {
        $existing = (int) Db::getInstance()->getValue(
            'SELECT id_tab FROM `' . _DB_PREFIX_ . 'tab`'
            . ' WHERE class_name = "AdminFrakIntegration"'
        );
        if ($existing !== 0) {
            return true;
        }
        $tab = new Tab();
        $tab->active = 1;
        $tab->class_name = 'AdminFrakIntegration';
        $tab->name = [];
        foreach (Language::getLanguages(true) as $lang) {
            $tab->name[$lang['id_lang']] = $module->l('Frak');
        }
        // The parent tab id is read through `Tab::getIdFromClassName()` here
        // intentionally — `AdminParentModulesSf` is a PrestaShop core tab
        // that this module never deletes, so its cached id is always
        // accurate. Only the SELF lookup above needed the cache bypass.
        $tab->id_parent = (int) Tab::getIdFromClassName('AdminParentModulesSf');
        $tab->module = $module->name;
        // Log when `Tab::add()` returns false. Silent failure here is the
        // killer in the upgrade path: `runUpgradeModule()` only re-runs the
        // *next* version's script when the current one returns true, so a
        // false return from registerTab() leaves the merchant stuck on a
        // working module BUT no admin sidebar entry, no `ps_tab` row, no
        // way to reach the configuration page from Module Manager. Surface
        // the diagnostic via PrestaShopLogger so Advanced Parameters → Logs
        // shows the actionable line instead of a silent void.
        if (!$tab->add()) {
            PrestaShopLogger::addLog(
                '[FrakSDK] FrakInstaller::registerTab — Tab::add() returned false for AdminFrakIntegration',
                3
            );
            return false;
        }
        return true;
    }

    /**
     * Symmetric Tab teardown. Best-effort — a missing or already-deleted
     * row is treated as success so a partially-installed module can still
     * uninstall cleanly.
     */
    public static function unregisterTab(): bool
    {
        // Direct DB query — mirrors the cache-bypass rationale on
        // {@see registerTab()}. `Tab::getIdFromClassName()` would return
        // a stale id when invoked after `cleanLeftovers()` in the same
        // request, leading to a `new Tab($staleId)` lookup against a
        // deleted row + a `delete()` that silently no-ops.
        $id_tab = (int) Db::getInstance()->getValue(
            'SELECT id_tab FROM `' . _DB_PREFIX_ . 'tab`'
            . ' WHERE class_name = "AdminFrakIntegration"'
        );
        if ($id_tab === 0) {
            return true;
        }
        $tab = new Tab($id_tab);
        return (bool) $tab->delete();
    }

    /**
     * Replicate the module-level access-role insert logic that PrestaShop
     * core's `Module::install()` runs inline (see PS 8.2.6
     * `classes/module/Module.php:463-479`). Inserts:
     *   - 4 × `ROLE_MOD_MODULE_FRAKINTEGRATION_{action}` rows in
     *     `authorization_role` (one per CRUD verb), and
     *   - 4 × `module_access` rows linking the new role to every employee
     *     profile that already holds the matching
     *     `ROLE_MOD_TAB_ADMINMODULESSF_{action}` access — i.e. every profile
     *     allowed to manage modules in general gets the same access on this
     *     module specifically.
     *
     * Closes the upgrade-path parity gap with fresh installs:
     * `parent::install()` does the role inserts in the install flow, but
     * PrestaShop's `runUpgradeModule()` NEVER enters `install()`, so an
     * upgrade-only path that goes through `Tab::add()` (via
     * {@see registerTab()}) ends up with the tab-level slugs
     * (`ROLE_MOD_TAB_ADMINFRAKINTEGRATION_*`) but missing the module-level
     * ones. Functionally the module still works; the BO Permissions UI just
     * doesn't expose per-action toggles for "install/uninstall/configure
     * this module". Calling this helper from upgrade scripts restores
     * byte-for-byte parity.
     *
     * Idempotent: `INSERT IGNORE` against `authorization_role.slug`
     * (`UNIQUE KEY (slug)`) and `module_access.(id_profile,
     * id_authorization_role)` (composite `PRIMARY KEY`) make re-runs
     * no-ops, so calling this on a healthy install or partially-healed
     * shop is free.
     */
    public static function ensureModuleAccessRoles(Module $module): bool
    {
        $db = Db::getInstance();
        $name = strtoupper(pSQL($module->name));
        $prefix = _DB_PREFIX_;
        $ok = true;

        foreach (['CREATE', 'READ', 'UPDATE', 'DELETE'] as $action) {
            $slug = 'ROLE_MOD_MODULE_' . $name . '_' . $action;
            try {
                // 1. Insert the role. `INSERT IGNORE` because slug is UNIQUE —
                //    healthy installs already have the row, and we want a
                //    no-op rather than a 1062 in that case.
                $db->execute(
                    'INSERT IGNORE INTO `' . $prefix . 'authorization_role` (`slug`)'
                    . " VALUES ('" . $slug . "')"
                );
                // 2. Wire `module_access` to every profile that already holds the
                //    paired tab-level access. Mirrors PS core's exact pattern
                //    (Module.php:471-478) so the resulting permission rows are
                //    indistinguishable from a fresh `parent::install()` run.
                //    `INSERT IGNORE` is safe — `module_access` PK is
                //    `(id_profile, id_authorization_role)`, so re-runs collapse.
                $db->execute(
                    'INSERT IGNORE INTO `' . $prefix . 'module_access`'
                    . ' (`id_profile`, `id_authorization_role`)'
                    . ' SELECT a.id_profile, ('
                    . '   SELECT id_authorization_role FROM `' . $prefix . 'authorization_role`'
                    . "   WHERE slug = '" . $slug . "' LIMIT 1"
                    . ' )'
                    . ' FROM `' . $prefix . 'access` a'
                    . ' INNER JOIN `' . $prefix . 'authorization_role` r'
                    . '   ON r.id_authorization_role = a.id_authorization_role'
                    . "   AND r.slug = 'ROLE_MOD_TAB_ADMINMODULESSF_" . $action . "'"
                );
            } catch (\Throwable $e) {
                PrestaShopLogger::addLog(
                    '[FrakSDK] ensureModuleAccessRoles step "' . $action . '" failed: ' . $e->getMessage(),
                    3
                );
                $ok = false;
            }
        }

        return $ok;
    }
}
