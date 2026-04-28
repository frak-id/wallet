{*
   Frak admin settings — backend-driven configuration baseline.

   Layout mirrors the WordPress plugin's `admin/views/settings-page.php`:
   one Website Information section, one Purchase Tracking / Webhook
   Configuration section, one Component Placements section listing every
   placement registered by `FrakPlacementRegistry`, and one Webhook Queue
   Health panel reading `FrakWebhookQueue::stats()`.

   The brand + webhook secret + placement toggles share a single `<form>`
   so the merchant gets one Save button; the explicit operations (Refresh
   Merchant, Drain queue) submit to small dedicated forms because they are
   stateful actions, not config writes.
*}

<div class="frak-links" style="margin-bottom: 16px;">
    <a href="{$frak_docs_url}" target="_blank" rel="noopener">📚 {l s='Documentation' mod='frakintegration'}</a>
    &nbsp;|&nbsp;
    <a href="{$frak_dashboard_url}" target="_blank" rel="noopener">🎯 {l s='Dashboard' mod='frakintegration'}</a>
</div>

<form id="frak_settings_form" class="defaultForm form-horizontal" action="{$form_action}" method="post" enctype="multipart/form-data">

    <div class="panel">
        <h3><i class="icon icon-info-circle"></i> {l s='Website Information' mod='frakintegration'}</h3>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Shop Name' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_SHOP_NAME" value="{$shop_name|escape:'html':'UTF-8'}" class="form-control" />
                <p class="help-block">
                    {l s='The display name surfaced to users in the Frak modal. Defaults to the PrestaShop shop name when empty.' mod='frakintegration'}
                </p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Logo' mod='frakintegration'}</label>
            <div class="col-lg-6">
                <div class="form-group">
                    <label class="control-label">{l s='Logo URL' mod='frakintegration'}</label>
                    <input type="text" name="FRAK_LOGO_URL" id="logo_url_input" value="{$logo_url|escape:'html':'UTF-8'}" placeholder="{l s='Enter logo URL' mod='frakintegration'}" class="form-control" />
                    {if $logo_url && strpos($logo_url, 'modules/frakintegration/uploads/') !== false}
                        <p class="help-block" style="color: #5cb85c; font-size: 11px;">
                            <i class="icon-check"></i> {l s='Currently using uploaded file' mod='frakintegration'}
                        </p>
                    {/if}
                </div>
                <div class="form-group">
                    <label class="control-label">{l s='Or upload a file' mod='frakintegration'}</label>
                    <input type="file" name="FRAK_LOGO_FILE" id="logo_file_input" accept="image/*" />
                    <p class="help-block">{l s='Supported formats: JPG, PNG, GIF, SVG (max 2MB)' mod='frakintegration'}</p>
                </div>
            </div>
            <div class="col-lg-3">
                <div class="logo-preview">
                    <label class="control-label">{l s='Preview' mod='frakintegration'}</label>
                    <div id="logo_preview_container" style="border: 1px solid #ddd; padding: 10px; text-align: center; min-height: 100px; background-color: #f9f9f9;">
                        {if $logo_url}
                            <img id="logo_preview" src="{$logo_url|escape:'html':'UTF-8'}" alt="Logo preview" style="max-width: 100%; max-height: 80px;" />
                        {else}
                            <p id="no_logo_text" style="color: #999; margin: 30px 0;">{l s='No logo selected' mod='frakintegration'}</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="panel">
        <h3><i class="icon icon-cogs"></i> {l s='Purchase Tracking' mod='frakintegration'}</h3>
        <p class="help-block">
            {l s='Order updates are delivered to Frak via an HMAC-SHA256 signed webhook. Generate the secret in your Frak business dashboard, paste it below, then make sure the merchant record below shows as resolved.' mod='frakintegration'}
        </p>

        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Webhook Secret' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text"
                       name="FRAK_WEBHOOK_SECRET"
                       value="{$webhook_secret|escape:'html':'UTF-8'}"
                       placeholder="{l s='Paste the webhook secret from your Frak dashboard' mod='frakintegration'}"
                       class="form-control" />
                <p class="help-block">
                    {l s='Generate the secret in your Frak business dashboard (Merchant → Purchase Tracker → PrestaShop) and paste it here. Saving this form re-applies the new secret on every outbound webhook.' mod='frakintegration'}
                </p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Merchant' mod='frakintegration'}</label>
            <div class="col-lg-9">
                {if $merchant_resolved}
                    <p class="form-control-static">
                        <span class="label label-success">{l s='✓ Connected' mod='frakintegration'}</span>
                        {if $merchant_name}<strong>{$merchant_name|escape:'html':'UTF-8'}</strong>{/if}
                        <code>{$merchant_id|escape:'html':'UTF-8'}</code>
                    </p>
                {else}
                    <p class="form-control-static">
                        <span class="label label-danger">{l s='✗ Not resolved for this domain' mod='frakintegration'}</span>
                    </p>
                    <p class="help-block">
                        {l s='Add' mod='frakintegration'} <code>{$domain|escape:'html':'UTF-8'}</code>
                        {l s='under Merchant → Allowed Domains in the Frak business dashboard, then click "Refresh Merchant".' mod='frakintegration'}
                    </p>
                {/if}
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Site Information' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <p class="form-control-static">
                    <strong>{l s='Domain:' mod='frakintegration'}</strong> <code>{$domain|escape:'html':'UTF-8'}</code><br>
                    {if $webhook_url}
                        <strong>{l s='Webhook URL:' mod='frakintegration'}</strong> <code>{$webhook_url|escape:'html':'UTF-8'}</code>
                    {/if}
                </p>
            </div>
        </div>
        {if $cron_url}
            <div class="form-group">
                <label class="control-label col-lg-3">{l s='Retry Cron' mod='frakintegration'}</label>
                <div class="col-lg-9">
                    <p class="form-control-static">
                        <code style="word-break: break-all;">{$cron_url|escape:'html':'UTF-8'}</code>
                    </p>
                    <p class="help-block">
                        {l s='Failed webhook deliveries are queued and retried with exponential backoff (5 min → 24 h, 5 attempts). Wire this URL into a cron that runs every 5 min — either via the official ps_cronjobs module, or as a server-level cron job (e.g. */5 * * * * curl -fs <URL>). The token in the URL gates access; rotate it by deleting FRAK_CRON_TOKEN and reinstalling the module.' mod='frakintegration'}
                    </p>
                </div>
            </div>
        {/if}
    </div>

    {if !empty($placement_groups)}
        <div class="panel">
            <h3><i class="icon icon-puzzle-piece"></i> {l s='Component Placements' mod='frakintegration'}</h3>
            <p class="help-block">
                {l s='Pick which Frak components render automatically on which storefront surfaces. The legacy product / order placements are on by default; the auxiliary surfaces (cart, top banner, homepage banner, footer banner) are off by default to keep upgrades visually unchanged.' mod='frakintegration'}
                <br>
                {l s='Need a custom placement? Drop one of the Smarty function plugins anywhere in your theme: {frak_banner placement="hero"}, {frak_share_button text="Share & earn"}, {frak_post_purchase variant="referrer"}.' mod='frakintegration'}
            </p>

            {foreach from=$placement_groups key=component item=group}
                <fieldset style="margin-top: 16px; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 4px;">
                    <legend style="font-size: 14px; font-weight: 600; padding: 0 8px;">{$group.label|escape:'html':'UTF-8'}</legend>
                    {foreach from=$group.items item=item}
                        <div class="form-group" style="margin-bottom: 8px;">
                            <div class="col-lg-12">
                                {* Hidden marker so the controller can distinguish "checkbox unchecked" from "form did not include this placement" — see processPlacementToggles() in AdminFrakIntegrationController.php. *}
                                <input type="hidden" name="{$item.config_key|escape:'html':'UTF-8'}__present" value="1" />
                                <label style="font-weight: normal; cursor: pointer;">
                                    <input type="checkbox"
                                           name="{$item.config_key|escape:'html':'UTF-8'}"
                                           value="1"
                                           {if $item.enabled}checked="checked"{/if} />
                                    <strong>{$item.label|escape:'html':'UTF-8'}</strong>
                                </label>
                                <p class="help-block" style="margin: 4px 0 0 22px; font-size: 12px;">
                                    {$item.description|escape:'html':'UTF-8'}
                                    <br>
                                    <small style="color: #888;">
                                        {l s='Hook:' mod='frakintegration'} <code>{$item.hook|escape:'html':'UTF-8'}</code>
                                        &nbsp;·&nbsp;
                                        {l s='Placement:' mod='frakintegration'} <code>{$item.placement_attr|escape:'html':'UTF-8'}</code>
                                    </small>
                                </p>
                            </div>
                        </div>
                    {/foreach}
                </fieldset>
            {/foreach}
        </div>
    {/if}

    <div class="panel-footer">
        <button type="submit" name="submitFrakSettings" class="btn btn-primary">
            <i class="process-icon-save"></i> {l s='Save Settings' mod='frakintegration'}
        </button>
    </div>
</form>

{*
   Auxiliary action buttons. Each lives in its own small <form> because they
   represent stateful operations (force a network round-trip, drain the
   queue) rather than config writes — keeping them out of the main Save form
   prevents accidental triggers on every submit.
*}
<div class="panel">
    <h3><i class="icon icon-bolt"></i> {l s='Maintenance' mod='frakintegration'}</h3>
    <div class="row">
        <div class="col-lg-6">
            <h4>{l s='Merchant resolver' mod='frakintegration'}</h4>
            <p class="help-block">
                {l s='Force a fresh GET /user/merchant/resolve round-trip — invalidates the per-domain cache and the negative cache. Use after a domain rename or right after registering the shop on the dashboard.' mod='frakintegration'}
            </p>
            <form action="{$form_action}" method="post" style="display: inline;">
                <button type="submit" name="refreshFrakMerchant" class="btn btn-default">
                    <i class="icon-refresh"></i> {l s='Refresh Merchant' mod='frakintegration'}
                </button>
                <a href="{$merchant_dashboard_url|escape:'html':'UTF-8'}" target="_blank" rel="noopener" class="btn btn-default">
                    <i class="icon-external-link"></i> {l s='Manage on Frak' mod='frakintegration'}
                </a>
            </form>
        </div>

        <div class="col-lg-6">
            <h4>{l s='Webhook queue' mod='frakintegration'}</h4>
            <table class="table" style="margin-bottom: 12px;">
                <tbody>
                    <tr>
                        <th style="width: 50%;">{l s='Pending' mod='frakintegration'}</th>
                        <td>
                            <code>{$queue_stats.pending|escape:'html':'UTF-8'}</code>
                            {if $queue_stats.oldest_pending_at}
                                <br><small style="color: #888;">
                                    {l s='Next attempt:' mod='frakintegration'} {$queue_stats.oldest_pending_at|escape:'html':'UTF-8'}
                                </small>
                            {/if}
                        </td>
                    </tr>
                    <tr>
                        <th>{l s='Delivered' mod='frakintegration'}</th>
                        <td><code>{$queue_stats.success|escape:'html':'UTF-8'}</code></td>
                    </tr>
                    <tr>
                        <th>{l s='Parked (failed)' mod='frakintegration'}</th>
                        <td>
                            <code>{$queue_stats.failed|escape:'html':'UTF-8'}</code>
                            {if $queue_stats.failed > 0}
                                &nbsp;<span class="label label-danger">{l s='Investigate logs' mod='frakintegration'}</span>
                            {/if}
                        </td>
                    </tr>
                    {if $queue_stats.last_error}
                        <tr>
                            <th>{l s='Last error' mod='frakintegration'}</th>
                            <td>
                                <small style="color: #b94a48; word-break: break-word;">{$queue_stats.last_error|truncate:200:'…':true|escape:'html':'UTF-8'}</small>
                                {if $queue_stats.last_error_at}
                                    <br><small style="color: #888;">{$queue_stats.last_error_at|escape:'html':'UTF-8'}</small>
                                {/if}
                            </td>
                        </tr>
                    {/if}
                </tbody>
            </table>
            <form action="{$form_action}" method="post" style="display: inline;">
                <button type="submit" name="drainFrakQueue" class="btn btn-default">
                    <i class="icon-bolt"></i> {l s='Drain queue now' mod='frakintegration'}
                </button>
            </form>
        </div>
    </div>
</div>

<script>
    // Live logo preview — kept from the legacy template because it is genuinely
    // useful (admin sees the file render before submitting). Everything else
    // (style-toggle JS, file-name placeholder swap) is gone alongside the
    // legacy form fields.
    document.addEventListener('DOMContentLoaded', function() {
        const logoUrlInput = document.getElementById('logo_url_input');
        const logoFileInput = document.getElementById('logo_file_input');
        const logoPreviewContainer = document.getElementById('logo_preview_container');
        const logoPreview = document.getElementById('logo_preview');
        const noLogoText = document.getElementById('no_logo_text');

        function updatePreview(src) {
            if (src) {
                if (logoPreview) {
                    logoPreview.src = src;
                    logoPreview.style.display = 'block';
                } else {
                    const img = document.createElement('img');
                    img.id = 'logo_preview';
                    img.src = src;
                    img.alt = 'Logo preview';
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '80px';
                    logoPreviewContainer.appendChild(img);
                }
                if (noLogoText) {
                    noLogoText.style.display = 'none';
                }
            } else if (logoPreview) {
                logoPreview.style.display = 'none';
            }
        }

        if (logoUrlInput) {
            logoUrlInput.addEventListener('input', function() {
                updatePreview(this.value);
                if (this.value && logoFileInput) {
                    logoFileInput.value = '';
                }
            });
        }

        if (logoFileInput) {
            logoFileInput.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        updatePreview(e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });
</script>
