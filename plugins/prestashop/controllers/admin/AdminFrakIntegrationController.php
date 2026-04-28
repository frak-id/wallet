<?php

class AdminFrakIntegrationController extends ModuleAdminController
{
    public function __construct()
    {
        $this->bootstrap = true;
        $this->display = 'view';
        parent::__construct();
        $this->meta_title = $this->l('Frak Integration');
    }

    /**
     * Register the per-route admin assets. Loaded only on this controller's
     * page — PrestaShop's `setMedia()` is scoped per-controller, so the JS does
     * not leak into other admin views.
     *
     * Inline `<script>` previously lived in `configure.tpl`; extracting to a
     * static file lets browsers cache it across admin renders and removes the
     * `unsafe-inline` requirement from any merchant-side Content-Security-Policy.
     *
     * @param bool $isNewTheme PrestaShop signature passthrough (unused here).
     */
    public function setMedia($isNewTheme = false)
    {
        parent::setMedia($isNewTheme);
        $this->addJS($this->module->getPathUri() . 'views/js/admin.js');
    }

    public function renderView()
    {
        $merchant = FrakMerchantResolver::getRecord();
        $shop_name = Configuration::get('FRAK_SHOP_NAME');
        $logo_url = Configuration::get('FRAK_LOGO_URL');

        $this->context->smarty->assign([
            'module_dir' => $this->module->getPathUri(),
            'form_action' => $this->context->link->getAdminLink('AdminFrakIntegration'),
            'shop_name' => $shop_name ?: Configuration::get('PS_SHOP_NAME'),
            'logo_url' => $logo_url,
            'webhook_secret' => Configuration::get('FRAK_WEBHOOK_SECRET'),
            'webhook_url' => FrakWebhookHelper::getWebhookUrl(),
            'webhook_secret_configured' => !empty(Configuration::get('FRAK_WEBHOOK_SECRET')),
            'cron_url' => $this->buildCronUrl(),
            'frak_dashboard_url' => 'https://business.frak.id/',
            'frak_docs_url' => 'https://docs.frak.id/components/frak-setup',
            'domain' => FrakUtils::currentHost(),
            'merchant_id' => $merchant['id'] ?? '',
            'merchant_name' => $merchant['name'] ?? '',
            'merchant_resolved' => $merchant !== null,
            'merchant_dashboard_url' => $merchant !== null
                ? 'https://business.frak.id/merchant/' . $merchant['id']
                : 'https://business.frak.id/',
            'placement_groups' => $this->buildPlacementGroups(),
            'queue_stats' => FrakWebhookQueue::stats(),
        ]);

        return $this->context->smarty->fetch($this->getTemplatePath() . 'configure.tpl');
    }

    /**
     * Build the public URL the merchant copy-pastes into their server cron.
     * Returns an empty string when the cron token has not been provisioned yet
     * (shouldn't happen on a fresh install, but the guard keeps the admin
     * page renderable on broken upgrades). The token is exposed verbatim
     * because the merchant needs to invoke the URL from outside the admin
     * session — we already gate read access to it behind admin auth on this
     * page.
     */
    private function buildCronUrl(): string
    {
        $token = (string) Configuration::get('FRAK_CRON_TOKEN');
        if ($token === '') {
            return '';
        }
        $base = $this->context->link->getBaseLink(null, true);
        return rtrim($base, '/')
            . '/index.php?fc=module&module=frakintegration&controller=cron&token='
            . rawurlencode($token);
    }

    /**
     * Group registered placements by component so the template renders one
     * `<fieldset>` per component (Banner / Share button / Post-purchase) with
     * its toggles inside. The grouping is computed here (rather than in the
     * template) so the Smarty file stays declarative.
     *
     * Each placement entry carries its current enabled state alongside its
     * static metadata so the template's `<input type="checkbox">` can wire
     * `checked` from `enabled` without re-reading Configuration.
     *
     * @return array<string, array{label: string, items: array<int, array<string, mixed>>}>
     */
    private function buildPlacementGroups(): array
    {
        $component_labels = [
            FrakPlacementRegistry::COMPONENT_SHARE_BUTTON => $this->l('Share button'),
            FrakPlacementRegistry::COMPONENT_BANNER => $this->l('Banner'),
            FrakPlacementRegistry::COMPONENT_POST_PURCHASE => $this->l('Post-purchase card'),
        ];

        $groups = [];
        foreach ($component_labels as $component => $label) {
            $groups[$component] = ['label' => $label, 'items' => []];
        }

        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $component = $placement['component'];
            if (!isset($groups[$component])) {
                continue;
            }
            $groups[$component]['items'][] = [
                'id' => $id,
                'config_key' => $placement['config_key'],
                'label' => $this->l($placement['label']),
                'description' => $this->l($placement['description']),
                'hook' => $placement['hook'],
                'placement_attr' => $placement['placement_attr'],
                'enabled' => FrakPlacementRegistry::isEnabled($id),
            ];
        }

        // Strip empty groups so the template does not render orphaned
        // headings (e.g. if a future component has no placements yet).
        return array_filter(
            $groups,
            static fn (array $group): bool => !empty($group['items'])
        );
    }

    public function postProcess()
    {
        if (Tools::isSubmit('submitFrakSettings')) {
            $this->processBrandFields();
            $this->processWebhookSecret();
            $this->processPlacementToggles();
            $this->clearStorefrontCaches();
        }

        if (Tools::isSubmit('refreshFrakMerchant')) {
            $this->processMerchantRefresh();
        }

        if (Tools::isSubmit('drainFrakQueue')) {
            $this->processDrainQueue();
        }
    }

    /**
     * Persist the brand-section fields (shop name + logo URL/file). A
     * successful file upload replaces the typed-in URL so the merchant can
     * paste a placeholder + drop a file in one round-trip.
     */
    private function processBrandFields(): void
    {
        $shopName = strval(Tools::getValue('FRAK_SHOP_NAME'));
        $logoUrl = strval(Tools::getValue('FRAK_LOGO_URL'));
        $baseUrl = $this->context->link->getBaseLink();

        if (isset($_FILES['FRAK_LOGO_FILE']) && $_FILES['FRAK_LOGO_FILE']['error'] === UPLOAD_ERR_OK) {
            $result = FrakLogoUploader::processUpload($_FILES['FRAK_LOGO_FILE'], $baseUrl);
            if (isset($result['url'])) {
                $logoUrl = $result['url'];
                $this->confirmations[] = $this->l('Logo uploaded successfully');
            } else {
                $this->errors[] = $this->translateLogoError((string) ($result['error'] ?? ''));
            }
        }

        if (!$shopName || empty($shopName) || !Validate::isGenericName($shopName)) {
            $this->errors[] = $this->l('Invalid Shop Name');
            return;
        }
        if (!$logoUrl || empty($logoUrl) || (!Validate::isUrl($logoUrl) && !FrakLogoUploader::isLocalUrl($logoUrl, $baseUrl))) {
            $this->errors[] = $this->l('Invalid Logo URL');
            return;
        }

        Configuration::updateValue('FRAK_SHOP_NAME', $shopName);
        Configuration::updateValue('FRAK_LOGO_URL', $logoUrl);
        $this->confirmations[] = $this->l('Brand settings updated');
    }

    /**
     * Map a {@see FrakLogoUploader} error code to a translated user-facing
     * message. Kept on the controller (not the helper) so the helper stays
     * i18n-agnostic and unit-testable without bootstrapping PrestaShop.
     */
    private function translateLogoError(string $code): string
    {
        switch ($code) {
            case FrakLogoUploader::ERROR_INVALID_FORMAT:
                return $this->l('Invalid file format. Only JPG, PNG, GIF, SVG files are allowed.');
            case FrakLogoUploader::ERROR_MIME_MISMATCH:
                return $this->l('File contents do not match the declared image extension. Re-export the logo from your image editor and try again.');
            case FrakLogoUploader::ERROR_TOO_LARGE:
                return $this->l('File size exceeds 2MB limit.');
            case FrakLogoUploader::ERROR_MOVE_FAILED:
                return $this->l('Failed to upload logo file');
            default:
                return $this->l('Unknown logo upload error');
        }
    }

    /**
     * Persist the webhook secret. Empty submissions clear the row and disable
     * dispatch — mirrors the WordPress plugin's pattern. The secret is owned
     * by the Frak business dashboard (single source of truth, stored on
     * `merchantWebhooksTable.hookSignatureKey`); the admin pastes it here so
     * outbound HMAC signatures match what the backend verifies.
     */
    private function processWebhookSecret(): void
    {
        if (!Tools::getIsset('FRAK_WEBHOOK_SECRET')) {
            return;
        }
        $submittedSecret = strval(Tools::getValue('FRAK_WEBHOOK_SECRET'));
        $previousSecret = (string) Configuration::get('FRAK_WEBHOOK_SECRET');
        if ($submittedSecret === $previousSecret) {
            return;
        }
        Configuration::updateValue('FRAK_WEBHOOK_SECRET', $submittedSecret);
        $this->confirmations[] = $this->l('Webhook secret updated');
    }

    /**
     * Persist placement on/off toggles from the rendered checkboxes. The form
     * lists every registered placement; an unchecked checkbox is absent from
     * `$_POST`, so we treat "missing" as "disabled" instead of "leave alone"
     * — otherwise the merchant could never turn a placement off.
     */
    private function processPlacementToggles(): void
    {
        $changed = 0;
        foreach (FrakPlacementRegistry::PLACEMENTS as $placement) {
            $key = $placement['config_key'];
            // The rendered form emits a hidden `<input name="…__present" value="1">`
            // alongside each checkbox so we can distinguish "form did not include
            // this placement" (do nothing) from "checkbox unchecked" (write 0).
            if (!Tools::getIsset($key . '__present')) {
                continue;
            }
            $next = Tools::getValue($key) ? '1' : '0';
            $current = (string) Configuration::get($key);
            if ($next === $current) {
                continue;
            }
            Configuration::updateValue($key, $next);
            $changed++;
        }
        if ($changed > 0) {
            $this->confirmations[] = $this->l('Placement settings updated');
        }
    }

    /**
     * Force-refresh the cached merchant resolver record. Wired to the
     * "Refresh Merchant" button — invalidates the per-domain cache and the
     * negative cache, then re-queries `GET /user/merchant/resolve` so a
     * domain rename / fresh registration shows up immediately.
     */
    private function processMerchantRefresh(): void
    {
        FrakMerchantResolver::invalidate();
        $merchant = FrakMerchantResolver::getRecord();
        if ($merchant !== null) {
            $this->confirmations[] = $this->l('Merchant resolved') . ': ' . $merchant['id'];
            return;
        }
        $this->errors[] = $this->l('Merchant not resolved for the current domain. Register the shop in the Frak dashboard.');
    }

    /**
     * Synchronous drainer trigger — wired to the "Drain now" button on the
     * queue health panel. Handy when the cron URL has not been wired up yet,
     * or when the merchant wants to flush a build-up after fixing a backend
     * outage without waiting for the next cron tick.
     */
    private function processDrainQueue(): void
    {
        $stats = FrakWebhookCron::run();
        $this->confirmations[] = sprintf(
            $this->l('Webhook queue drained: %1$d processed (%2$d success, %3$d failure)'),
            (int) $stats['processed'],
            (int) $stats['success'],
            (int) $stats['failure']
        );
    }

    /**
     * Flush the storefront caches so the next request regenerates the head
     * template with the freshly-saved brand / merchant config. Without this,
     * shops behind a Smarty cache or a third-party page cache (LiteSpeed,
     * Hyper Cache, PageCache Ultimate, …) keep serving the previous
     * `window.FrakSetup` payload until the cache TTL expires — could be
     * hours, which feels like the Save button silently failed.
     *
     * Mirrors WordPress's `Frak_Admin::clear_caches()` (which fans out to
     * five known page-cache plugins). PrestaShop has a more standardised
     * surface: the built-in `Tools::clear*Cache()` calls cover Smarty + the
     * XML descriptor / media manifests, and the public `actionClearCache`
     * hook propagates to well-behaved third-party cache modules without the
     * plugin needing to know each one by name.
     *
     * Scoped to the settings-save path — maintenance buttons (Refresh
     * Merchant, Drain Queue) do not change frontend-visible config and skip
     * the flush to keep their own latency low.
     */
    private function clearStorefrontCaches(): void
    {
        if (method_exists('Tools', 'clearSmartyCache')) {
            Tools::clearSmartyCache();
        }
        if (method_exists('Tools', 'clearXMLCache')) {
            Tools::clearXMLCache();
        }
        if (class_exists('Media') && method_exists('Media', 'clearCache')) {
            Media::clearCache();
        }
        if (class_exists('Hook') && method_exists('Hook', 'exec')) {
            Hook::exec('actionClearCache');
        }
    }
}
