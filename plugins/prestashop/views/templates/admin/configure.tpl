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
   stateful actions, not config writes. The Save button lives in the sticky
   bar at the end of the page and reaches the settings form through its
   `form` attribute, so it stays on screen over every section.
*}

{if $frak_env_dev || $frak_env_ignored !== null || $frak_env_domain !== ''}
<div class="alert alert-warning" id="frak_env_notice">
    <p><strong>{l s='Frak development switch is on.' mod='frakintegration'}</strong>
        {l s='Remove the constants from config/defines_custom.inc.php to return to production.' mod='frakintegration'}</p>
    <ul>
        {if $frak_env_dev}
            <li><code>FRAK_ENV</code> = <code>dev</code>: {l s='the SDK, the merchant lookup, the order webhook and the dashboard links use the Frak dev stack.' mod='frakintegration'}</li>
        {/if}
        {if $frak_env_ignored !== null}
            <li><code>FRAK_ENV</code> = <code>{$frak_env_ignored|escape:'html':'UTF-8'}</code>: {l s='only "dev" is recognised, so this value is ignored.' mod='frakintegration'}</li>
        {/if}
        {if $frak_env_domain !== ''}
            <li><code>FRAK_MERCHANT_DOMAIN</code> = <code>{$frak_env_domain|escape:'html':'UTF-8'}</code>: {l s='this shop acts as that merchant. Rewards and order webhooks are attributed to that merchant, not to this shop.' mod='frakintegration'}</li>
        {/if}
    </ul>
</div>
{/if}

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
            {l s='Order updates are delivered to Frak via an HMAC-SHA256 signed webhook. Get the secret from your Frak business dashboard, paste it below, then make sure the merchant record below shows as connected.' mod='frakintegration'}
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
                    {l s='In your Frak business dashboard, open Merchant → Purchase Tracker, select Custom, copy the secret and click Register. Then paste it here and save: every webhook sent after that is signed with the new secret.' mod='frakintegration'}
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
                    {if $ps_cronjobs_enabled}
                        <p class="form-control-static">
                            <span class="label label-success">{l s='✓ Auto-registered with ps_cronjobs' mod='frakintegration'}</span>
                        </p>
                        <p class="help-block">
                            {l s='The webhook drainer is registered with the ps_cronjobs module and runs on its hourly tick — no further action needed. The URL below is still available if you prefer to wire a server-level cron for sub-hourly cadence (the two paths share the same drainer and are safe to run in parallel).' mod='frakintegration'}
                        </p>
                    {else}
                        <p class="help-block">
                            {l s='Failed webhook deliveries are queued and retried with exponential backoff (5 min → 24 h, 5 attempts). Wire this URL into a cron that runs every 5 min — either install the official ps_cronjobs module (this module auto-registers itself when ps_cronjobs is present), or run it as a server-level cron job (e.g. */5 * * * * curl -fs <URL>). The token in the URL gates access; rotate it by deleting FRAK_CRON_TOKEN and reinstalling the module.' mod='frakintegration'}
                        </p>
                    {/if}
                    <p class="form-control-static">
                        <code style="word-break: break-all;">{$cron_url|escape:'html':'UTF-8'}</code>
                    </p>
                </div>
            </div>
        {/if}
    </div>

    <div class="panel">
        <h3><i class="icon icon-bell"></i> {l s='Reward reminder' mod='frakintegration'}</h3>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Reminder badge' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="hidden" name="FRAK_REWARD_REMINDER__present" value="1" />
                <div class="checkbox frak-checkbox">
                    <label>
                        <input type="checkbox"
                               name="FRAK_REWARD_REMINDER"
                               value="1"
                               {if $reward_reminder_enabled}checked="checked"{/if} />
                        {l s='Show the reward reminder' mod='frakintegration'}
                    </label>
                </div>
                <p class="help-block frak-checkbox-help">
                    {l s='Shows a small badge to shoppers who earned a reward on your store but haven\'t created their Frak wallet yet, with the amount and the days left before it expires. Unclaimed rewards are never paid out. Other visitors never see it.' mod='frakintegration'}
                </p>
            </div>
        </div>
    </div>

    {if !empty($placement_groups)}
        <div class="panel">
            <h3><i class="icon icon-puzzle-piece"></i> {l s='Component Placements' mod='frakintegration'}</h3>
            <p class="help-block frak-panel-intro">
                {l s='Pick which Frak components render automatically on which storefront surfaces. Every placement stays off until you tick it.' mod='frakintegration'}
                <br>
                {l s='Need a custom placement? Type one of these tags in a theme template or in a CMS page (Design → Pages): {frak_ambassador}, {frak_banner placement="hero"}, {frak_share_button text="Share & earn"}, {frak_post_purchase variant="referrer"}.' mod='frakintegration'}
            </p>

            {foreach from=$placement_groups key=component item=group}
                <div class="form-group frak-placement-group">
                    <label class="control-label col-lg-3">{$group.label|escape:'html':'UTF-8'}</label>
                    <div class="col-lg-9">
                        {foreach from=$group.items item=item}
                            <div class="frak-placement">
                                {* Hidden marker so the controller can distinguish "checkbox unchecked" from "form did not include this placement" — see processPlacements() in AdminFrakIntegrationController.php. *}
                                <input type="hidden" name="{$item.config_key|escape:'html':'UTF-8'}__present" value="1" />
                                <div class="checkbox frak-checkbox">
                                    <label>
                                        <input type="checkbox"
                                               name="{$item.config_key|escape:'html':'UTF-8'}"
                                               value="1"
                                               {if $item.enabled}checked="checked"{/if} />
                                        {$item.label|escape:'html':'UTF-8'}
                                    </label>
                                </div>
                                <p class="help-block frak-checkbox-help">{$item.description|escape:'html':'UTF-8'}</p>
                                <p class="frak-checkbox-help frak-placement__meta">
                                    {l s='Hook:' mod='frakintegration'} <code>{$item.hook|escape:'html':'UTF-8'}</code>
                                    &nbsp;·&nbsp;
                                    {l s='Placement:' mod='frakintegration'} <code>{$item.placement_attr|escape:'html':'UTF-8'}</code>
                                </p>
                                {if !empty($item.options)}
                                    <div class="frak-checkbox-help frak-placement__options">
                                        {foreach from=$item.options item=option}
                                            <div class="frak-placement__option">
                                                <label for="{$option.name|escape:'html':'UTF-8'}">{$option.label|escape:'html':'UTF-8'}</label>
                                                {if $option.type == 'select'}
                                                    <select id="{$option.name|escape:'html':'UTF-8'}" name="{$option.name|escape:'html':'UTF-8'}" class="form-control">
                                                        {foreach from=$option.choices item=choice}
                                                            <option value="{$choice.value|escape:'html':'UTF-8'}" {if $choice.value === $option.value}selected="selected"{/if}>{$choice.label|escape:'html':'UTF-8'}</option>
                                                        {/foreach}
                                                    </select>
                                                {elseif $option.type == 'text'}
                                                    <input type="text" id="{$option.name|escape:'html':'UTF-8'}" name="{$option.name|escape:'html':'UTF-8'}" value="{$option.value|escape:'html':'UTF-8'}" class="form-control" />
                                                {/if}
                                                {if $option.description}
                                                    <p class="help-block">{$option.description|escape:'html':'UTF-8'}</p>
                                                {/if}
                                            </div>
                                        {/foreach}
                                    </div>
                                {/if}
                            </div>
                        {/foreach}
                    </div>
                </div>
            {/foreach}
        </div>
    {/if}
</form>

{*
   Ambassador page state + create/restore action. Its own <form>, outside the
   settings form above, like the Maintenance actions.
*}
<div class="panel form-horizontal" id="frak_ambassador_panel">
    <h3><i class="icon icon-file-text"></i> {l s='Ambassador page' mod='frakintegration'}</h3>
    <div class="form-group">
        <label class="control-label col-lg-3">{l s='Page' mod='frakintegration'}</label>
        <div class="col-lg-9">
            {if $ambassador_page.type == 'live'}
                <p class="form-control-static frak-amb-status">
                    <span class="label label-success">{l s='✓ Live' mod='frakintegration'}</span>
                    <strong>{$ambassador_page.title|escape:'html':'UTF-8'}</strong>
                </p>
                {if !$ambassador_page.created}
                    <p class="help-block">
                        {l s='This page holds the {frak_ambassador} marker, which is why no Create button is offered. The page heading from your theme stays above the heading of the component.' mod='frakintegration'}
                    </p>
                {/if}
                <div class="frak-amb-actions">
                    <a href="{$ambassador_page.url|escape:'html':'UTF-8'}" target="_blank" rel="noopener" class="btn btn-default">
                        <i class="icon-external-link"></i> {l s='View page' mod='frakintegration'}
                    </a>
                    {if $ambassador_page.editUrl !== ''}
                        <a href="{$ambassador_page.editUrl|escape:'html':'UTF-8'}" target="_blank" rel="noopener" class="btn btn-default">
                            <i class="icon-pencil"></i> {l s='Edit page' mod='frakintegration'}
                        </a>
                    {/if}
                </div>
            {else}
                <form action="{$form_action}" method="post">
                    {if $ambassador_page.type == 'restorable'}
                        <p class="form-control-static frak-amb-status">
                            <span class="label label-warning">{l s='Inactive' mod='frakintegration'}</span>
                        </p>
                        <p class="help-block">
                            {l s='Your ambassador page exists but is inactive in Design → Pages. Restore it to publish it again at the same address.' mod='frakintegration'}
                        </p>
                        <div class="frak-amb-actions">
                            <button type="submit" name="submitFrakAmbassadorPage" class="btn btn-primary">
                                <i class="icon-refresh"></i> {l s='Restore my ambassador page' mod='frakintegration'}
                            </button>
                        </div>
                    {else}
                        <p class="form-control-static frak-amb-status">
                            <span class="label label-default">{l s='Not created' mod='frakintegration'}</span>
                        </p>
                        <p class="help-block">
                            {l s='Publish a page that lists your campaign rewards and lets customers share and earn. It is a regular page you can edit in Design → Pages.' mod='frakintegration'}
                        </p>
                        <div class="frak-amb-actions">
                            <button type="submit" name="submitFrakAmbassadorPage" class="btn btn-primary">
                                <i class="icon-plus"></i> {l s='Create my ambassador page' mod='frakintegration'}
                            </button>
                        </div>
                    {/if}
                </form>
            {/if}
            {if !$merchant_resolved}
                <p class="help-block frak-amb-hint">
                    {l s='The page shows your campaign once this domain is connected to your Frak merchant account.' mod='frakintegration'}
                </p>
            {/if}
        </div>
    </div>
</div>

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
            <div class="frak-queue-stats">
                <div class="frak-queue-stat">
                    <span class="frak-queue-stat__value">{$queue_stats.pending|intval}</span>
                    <span class="frak-queue-stat__label">{l s='Pending' mod='frakintegration'}</span>
                </div>
                <div class="frak-queue-stat">
                    <span class="frak-queue-stat__value">{$queue_stats.success|intval}</span>
                    <span class="frak-queue-stat__label">{l s='Delivered' mod='frakintegration'}</span>
                </div>
                <div class="frak-queue-stat{if $queue_stats.failed > 0} frak-queue-stat--alert{/if}">
                    <span class="frak-queue-stat__value">{$queue_stats.failed|intval}</span>
                    <span class="frak-queue-stat__label">{l s='Parked (failed)' mod='frakintegration'}</span>
                </div>
            </div>
            {if $queue_stats.oldest_pending_at}
                <p class="help-block frak-queue-note">
                    {l s='Next attempt:' mod='frakintegration'} {$queue_stats.oldest_pending_at|escape:'html':'UTF-8'}
                </p>
            {/if}
            {if $queue_stats.failed > 0}
                <p class="help-block frak-queue-note">
                    {l s='Parked deliveries are no longer retried. Check Advanced Parameters → Logs for entries prefixed FrakIntegration.' mod='frakintegration'}
                </p>
            {/if}
            {if $queue_stats.last_error}
                <div class="frak-queue-error">
                    <strong>{l s='Last error' mod='frakintegration'}</strong>
                    {if $queue_stats.last_error_at}
                        <span class="frak-queue-error__time">{$queue_stats.last_error_at|escape:'html':'UTF-8'}</span>
                    {/if}
                    <p>{$queue_stats.last_error|truncate:200:'…':true|escape:'html':'UTF-8'}</p>
                </div>
            {/if}
            <form action="{$form_action}" method="post" style="display: inline;">
                <button type="submit" name="drainFrakQueue" class="btn btn-default">
                    <i class="icon-bolt"></i> {l s='Drain queue now' mod='frakintegration'}
                </button>
            </form>
        </div>
    </div>
</div>

<div class="frak-save-bar">
    <p class="frak-save-bar__hint">
        {l s='Saves website information, purchase tracking, the reward reminder and component placements.' mod='frakintegration'}
    </p>
    <button type="submit" form="frak_settings_form" name="submitFrakSettings" class="btn btn-primary">
        <i class="icon-save"></i> {l s='Save Settings' mod='frakintegration'}
    </button>
</div>
