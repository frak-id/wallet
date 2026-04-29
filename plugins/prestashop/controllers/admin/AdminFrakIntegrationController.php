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
     * Register the admin-only static assets used by the Frak configuration
     * page.
     *
     * `views/js/admin.js` carries the live logo-preview wiring (URL input +
     * file-picker ↔ `<img>` in the side panel). Loading it via `addJS`
     * gets it cached by the browser across admin page loads (vs the inline
     * `<script>` it replaced in `configure.tpl`, which was re-shipped on
     * every render) and removes the `unsafe-inline` requirement merchants
     * running CSP would otherwise need.
     *
     * `setMedia` is scoped per-controller-route by `ModuleAdminController`,
     * so this fires only when the Frak admin page renders — not on every
     * back-office page.
     */
    public function setMedia($isNewTheme = false): void
    {
        parent::setMedia($isNewTheme);
        $this->addJS($this->module->getPathUri() . 'views/js/admin.js');
    }

    public function renderView()
    {
        $merchant = FrakMerchantResolver::getRecord();

        // Brand bundle + webhook secret read in one batched lookup via
        // {@see FrakConfig}. Each individual `Configuration::get` hits the
        // autoload cache, but the batched call collapses three (already
        // fast) lookups into one hashmap walk and keeps the FRAK_* key
        // strings out of the controller.
        $brand = FrakConfig::getBrand();
        $webhook_secret = FrakConfig::getWebhookSecret();

        $this->context->smarty->assign([
            'module_dir' => $this->module->getPathUri(),
            'form_action' => $this->context->link->getAdminLink('AdminFrakIntegration'),
            'shop_name' => $brand['name'],
            'logo_url' => $brand['logoUrl'],
            'webhook_secret' => $webhook_secret,
            'webhook_url' => FrakWebhookHelper::getWebhookUrl(),
            'webhook_secret_configured' => !empty($webhook_secret),
            'cron_url' => $this->buildCronUrl(),
            'ps_cronjobs_enabled' => $this->isPsCronjobsEnabled(),
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
        $token = FrakConfig::getCronToken();
        if ($token === '') {
            return '';
        }
        $base = $this->context->link->getBaseLink(null, true);
        return rtrim($base, '/')
            . '/index.php?fc=module&module=frakintegration&controller=cron&token='
            . rawurlencode($token);
    }

    /**
     * Detect whether the official `ps_cronjobs` module is installed AND
     * enabled on the current shop. When true, the module's `actionCronJob`
     * hook auto-registers the webhook drainer with `ps_cronjobs`'s cron
     * table — the merchant doesn't need to copy/paste the URL into a
     * server cron, they just need `ps_cronjobs`'s own cron URL wired up
     * (which it surfaces in its own admin page).
     *
     * Both checks are needed: `Module::isInstalled()` returns true even
     * for disabled modules, and `Module::isEnabled()` is the de-facto
     * gate `Hook::getHookModuleExecList()` consults when dispatching
     * `actionCronJob`. Returning the AND keeps the admin badge honest.
     */
    private function isPsCronjobsEnabled(): bool
    {
        return Module::isInstalled('ps_cronjobs') && Module::isEnabled('ps_cronjobs');
    }

    /**
     * Group registered placements by component so the template renders one
     * `<fieldset>` per component (Banner / Share button / Post-purchase) with
     * its toggles inside. The grouping is computed here (rather than in the
     * template) so the Smarty file stays declarative.
     *
     * Each placement entry carries its current enabled state, the static
     * metadata (label / description / hook / placement_attr), and a
     * pre-resolved `options[]` list — each option entry is shaped for the
     * template to render either a `<select>` (with pre-selected value) or an
     * `<input type="text">` (with the current value). Resolution happens here
     * so the template never reaches into the registry's option schema.
     *
     * Enabled values + option values are pulled from
     * {@see FrakPlacementRegistry::getResolvedState()} which decodes the
     * bundled storage row exactly once per request.
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

        // Fetch the resolved state once — isEnabled() / getOptions() would
        // re-decode it per call, this skips the loop overhead.
        $state = FrakPlacementRegistry::getResolvedState();

        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $component = $placement['component'];
            if (!isset($groups[$component])) {
                continue;
            }
            $entry = $state[$id] ?? ['enabled' => $placement['default'], 'options' => []];
            $groups[$component]['items'][] = [
                'id' => $id,
                'config_key' => $placement['config_key'],
                'label' => $this->l($placement['label']),
                'description' => $this->l($placement['description']),
                'hook' => $placement['hook'],
                'placement_attr' => $placement['placement_attr'],
                'enabled' => $entry['enabled'],
                'options' => $this->buildPlacementOptionInputs(
                    $placement['config_key'],
                    $placement['options'] ?? [],
                    $entry['options']
                ),
            ];
        }

        // Strip empty groups so the template does not render orphaned
        // headings (e.g. if a future component has no placements yet).
        return array_filter(
            $groups,
            static fn (array $group): bool => !empty($group['items'])
        );
    }

    /**
     * Reshape a placement's option schema + resolved values into the
     * template-ready list. Each entry carries the form input name (computed
     * from the placement's `config_key` + a stable `__option__<key>` suffix
     * so the controller can decode them on submit), the input type, the
     * current value, the merchant-facing label / description, and — for
     * `select` inputs — the choices map.
     *
     * Form input naming uses `__option__` (double underscore, separator
     * matches the existing `__present` marker) so input names tokenise
     * cleanly:
     *   - `FRAK_PLACEMENT_SHARE_PRODUCT__present` → hidden marker
     *   - `FRAK_PLACEMENT_SHARE_PRODUCT` → enable checkbox
     *   - `FRAK_PLACEMENT_SHARE_PRODUCT__option__buttonStyle` → option input
     *
     * @param string                              $config_key   Placement form-name prefix.
     * @param array<string, array<string, mixed>> $option_schema Schema from `PLACEMENTS[$id]['options']`.
     * @param array<string, mixed>                $option_values Resolved values from `getResolvedState()`.
     * @return array<int, array<string, mixed>>
     */
    private function buildPlacementOptionInputs(string $config_key, array $option_schema, array $option_values): array
    {
        $inputs = [];
        foreach ($option_schema as $key => $meta) {
            $type = (string) ($meta['type'] ?? '');
            $allowed_types = [FrakPlacementRegistry::OPTION_TYPE_SELECT, FrakPlacementRegistry::OPTION_TYPE_TEXT];
            if (!in_array($type, $allowed_types, true)) {
                continue;
            }
            $value = $option_values[$key] ?? ($meta['default'] ?? '');
            $entry = [
                'name' => $config_key . '__option__' . $key,
                'type' => $type,
                'label' => $this->l((string) ($meta['label'] ?? $key)),
                'description' => isset($meta['description']) ? $this->l((string) $meta['description']) : '',
                'value' => $value,
            ];
            if ($type === FrakPlacementRegistry::OPTION_TYPE_SELECT) {
                $choices = is_array($meta['choices'] ?? null) ? $meta['choices'] : [];
                $entry['choices'] = [];
                foreach ($choices as $choice_value => $choice_label) {
                    $entry['choices'][] = [
                        'value' => (string) $choice_value,
                        'label' => $this->l((string) $choice_label),
                    ];
                }
            }
            $inputs[] = $entry;
        }
        return $inputs;
    }

    public function postProcess()
    {
        if (Tools::isSubmit('submitFrakSettings')) {
            $this->processBrandFields();
            $this->processWebhookSecret();
            $this->processPlacements();
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

        // File upload is delegated to {@see FrakLogoUploader} so the validation
        // gates (extension allowlist, MIME match, SVG sniff, size cap) are
        // unit-testable without bootstrapping PrestaShop. Stable error codes
        // map to translated strings here at the controller boundary.
        if (isset($_FILES['FRAK_LOGO_FILE']) && $_FILES['FRAK_LOGO_FILE']['error'] === UPLOAD_ERR_OK) {
            $result = FrakLogoUploader::processUpload($_FILES['FRAK_LOGO_FILE'], $baseUrl);
            if (isset($result['error'])) {
                $this->errors[] = $this->mapLogoUploadError($result['error']);
            } elseif (isset($result['url'])) {
                $logoUrl = $result['url'];
                $this->confirmations[] = $this->l('Logo uploaded successfully');
            }
        }

        if (!$shopName || !Validate::isGenericName($shopName)) {
            $this->errors[] = $this->l('Invalid Shop Name');
            return;
        }
        if (!$logoUrl || (!Validate::isUrl($logoUrl) && !FrakLogoUploader::isLocalUrl($logoUrl, $baseUrl))) {
            $this->errors[] = $this->l('Invalid Logo URL');
            return;
        }

        FrakConfig::setShopName($shopName);
        FrakConfig::setLogoUrl($logoUrl);
        $this->confirmations[] = $this->l('Brand settings updated');
    }

    /**
     * Map a {@see FrakLogoUploader} error code to a translated user-facing
     * message. Lives on the controller because the helper is intentionally
     * i18n-agnostic (so it stays unit-testable without bootstrapping the
     * PrestaShop translation layer).
     */
    private function mapLogoUploadError(string $code): string
    {
        switch ($code) {
            case FrakLogoUploader::ERROR_INVALID_FORMAT:
                return $this->l('Invalid file format. Only JPG, PNG, GIF, SVG files are allowed.');
            case FrakLogoUploader::ERROR_TOO_LARGE:
                return $this->l('File size exceeds 2MB limit.');
            case FrakLogoUploader::ERROR_MIME_MISMATCH:
                return $this->l('Logo file content does not match its declared format.');
            case FrakLogoUploader::ERROR_MOVE_FAILED:
            default:
                return $this->l('Failed to upload logo file');
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
        if (!Tools::getIsset(FrakConfig::WEBHOOK_SECRET)) {
            return;
        }
        $submittedSecret = strval(Tools::getValue(FrakConfig::WEBHOOK_SECRET));
        $previousSecret = FrakConfig::getWebhookSecret();
        if ($submittedSecret === $previousSecret) {
            return;
        }
        FrakConfig::setWebhookSecret($submittedSecret);
        // Reset the helper's per-request memo so the new secret takes effect
        // immediately if any subsequent action in the same request triggers
        // a webhook (e.g. saving + draining the queue).
        FrakWebhookHelper::resetCache();
        $this->confirmations[] = $this->l('Webhook secret updated');
    }

    /**
     * Persist placement on/off toggles AND option values from the rendered
     * form. The form lists every registered placement; an unchecked checkbox
     * is absent from `$_POST`, so we treat "missing" as "disabled" instead of
     * "leave alone" — otherwise the merchant could never turn a placement
     * off. Option inputs are read off matching `__option__<key>` suffixes;
     * unsubmitted options preserve their stored value (writer-side).
     *
     * Writes go through {@see FrakPlacementRegistry::setState()} which
     * collapses every placement update (enabled flags + option values) into a
     * single bundled-row write — one round-trip vs the N writes a per-row
     * layout would need.
     */
    private function processPlacements(): void
    {
        $updates = [];
        foreach (FrakPlacementRegistry::PLACEMENTS as $id => $placement) {
            $form_key = $placement['config_key'];
            // The rendered form emits a hidden `<input name="…__present" value="1">`
            // alongside each checkbox so we can distinguish "form did not include
            // this placement" (do nothing) from "checkbox unchecked" (write 0).
            if (!Tools::getIsset($form_key . '__present')) {
                continue;
            }
            $update = ['enabled' => (bool) Tools::getValue($form_key)];

            // Collect any option submissions for this placement. Schema-unknown
            // keys are dropped by the registry's writer, but iterating the
            // schema (instead of $_POST) keeps the controller honest — we never
            // peek at form keys we did not render ourselves.
            $option_schema = $placement['options'] ?? [];
            if (!empty($option_schema)) {
                $option_updates = [];
                foreach ($option_schema as $option_key => $option_meta) {
                    $form_option_key = $form_key . '__option__' . $option_key;
                    if (!Tools::getIsset($form_option_key)) {
                        continue;
                    }
                    $option_updates[$option_key] = Tools::getValue($form_option_key);
                }
                if (!empty($option_updates)) {
                    $update['options'] = $option_updates;
                }
            }
            $updates[$id] = $update;
        }
        if (empty($updates)) {
            return;
        }

        // Skip the write when nothing actually changed — a noisy 'updated'
        // confirmation on every Save would be confusing.
        $current_state = FrakPlacementRegistry::getResolvedState();
        $changed = false;
        foreach ($updates as $id => $update) {
            $current_entry = $current_state[$id] ?? ['enabled' => null, 'options' => []];
            if (array_key_exists('enabled', $update) && $current_entry['enabled'] !== $update['enabled']) {
                $changed = true;
                break;
            }
            if (!empty($update['options'])) {
                foreach ($update['options'] as $option_key => $option_value) {
                    $existing = $current_entry['options'][$option_key] ?? null;
                    if ((string) $existing !== (string) $option_value) {
                        $changed = true;
                        break 2;
                    }
                }
            }
        }
        if (!$changed) {
            return;
        }
        if (FrakPlacementRegistry::setState($updates)) {
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
        // Drop the helper's URL memo too — the URL is derived from the
        // merchant id and would otherwise be stale within the same request.
        FrakWebhookHelper::resetCache();
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
        if (!empty($stats['skipped'])) {
            $this->errors[] = $this->l('Webhook queue drainer is already running. Try again in a few minutes.');
            return;
        }
        $this->confirmations[] = sprintf(
            $this->l('Webhook queue drained: %1$d processed (%2$d success, %3$d failure)'),
            (int) $stats['processed'],
            (int) $stats['success'],
            (int) $stats['failure']
        );
    }
}
