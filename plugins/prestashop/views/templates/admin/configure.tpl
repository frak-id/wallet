<div class="panel">
    <h3><i class="icon icon-toggle-on"></i> {l s='Buttons' mod='frakintegration'}</h3>
    <form id="module_form_buttons" class="defaultForm form-horizontal" action="{$form_action}" method="post">
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Enable Floating Button' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <span class="switch prestashop-switch fixed-width-lg">
                    <input type="radio" name="FRAK_FLOATING_BUTTON_ENABLED" id="FRAK_FLOATING_BUTTON_ENABLED_on" value="1" {if $floating_button_enabled}checked="checked"{/if}>
                    <label for="FRAK_FLOATING_BUTTON_ENABLED_on">{l s='Yes' mod='frakintegration'}</label>
                    <input type="radio" name="FRAK_FLOATING_BUTTON_ENABLED" id="FRAK_FLOATING_BUTTON_ENABLED_off" value="0" {if !$floating_button_enabled}checked="checked"{/if}>
                    <label for="FRAK_FLOATING_BUTTON_ENABLED_off">{l s='No' mod='frakintegration'}</label>
                    <a class="slide-button btn"></a>
                </span>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Enable Sharing Button' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <span class="switch prestashop-switch fixed-width-lg">
                    <input type="radio" name="FRAK_SHARING_BUTTON_ENABLED" id="FRAK_SHARING_BUTTON_ENABLED_on" value="1" {if $sharing_button_enabled}checked="checked"{/if}>
                    <label for="FRAK_SHARING_BUTTON_ENABLED_on">{l s='Yes' mod='frakintegration'}</label>
                    <input type="radio" name="FRAK_SHARING_BUTTON_ENABLED" id="FRAK_SHARING_BUTTON_ENABLED_off" value="0" {if !$sharing_button_enabled}checked="checked"{/if}>
                    <label for="FRAK_SHARING_BUTTON_ENABLED_off">{l s='No' mod='frakintegration'}</label>
                    <a class="slide-button btn"></a>
                </span>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Sharing Button Text' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_SHARING_BUTTON_TEXT" value="{$sharing_button_text}" />
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Sharing Button Style' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <select name="FRAK_SHARING_BUTTON_STYLE" id="frak_sharing_button_style">
                    <option value="primary" {if isset($sharing_button_style) && $sharing_button_style == 'primary'}selected="selected"{/if}>{l s='Primary' mod='frakintegration'}</option>
                    <option value="secondary" {if !isset($sharing_button_style) || $sharing_button_style == 'secondary'}selected="selected"{/if}>{l s='Secondary' mod='frakintegration'}</option>
                    <option value="custom" {if isset($sharing_button_style) && $sharing_button_style == 'custom'}selected="selected"{/if}>{l s='Custom' mod='frakintegration'}</option>
                </select>
            </div>
        </div>
        <div class="form-group" id="frak_sharing_button_custom_style_group" {if !isset($sharing_button_style) || $sharing_button_style != 'custom'}style="display: none;"{/if}>
            <label class="control-label col-lg-3">{l s='Custom CSS Class' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_SHARING_BUTTON_CUSTOM_STYLE" value="{if isset($sharing_button_custom_style)}{$sharing_button_custom_style}{/if}" />
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Floating Button Position' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <select name="FRAK_FLOATING_BUTTON_POSITION">
                    <option value="right" {if $floating_button_position == 'right'}selected="selected"{/if}>{l s='Right' mod='frakintegration'}</option>
                    <option value="left" {if $floating_button_position == 'left'}selected="selected"{/if}>{l s='Left' mod='frakintegration'}</option>
                </select>
            </div>
        </div>
        <div class="panel-footer">
            <button type="submit" value="1" name="submitFrakButtons" class="btn btn-default pull-right">
                <i class="process-icon-save"></i> {l s='Save' mod='frakintegration'}
            </button>
        </div>
    </form>
</div>

<div class="panel">
    <h3><i class="icon icon-paint-brush"></i> {l s='Modal Personnalisations' mod='frakintegration'}</h3>
    <form id="module_form_modal" class="defaultForm form-horizontal" action="{$form_action}" method="post" enctype="multipart/form-data">
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Shop Name' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_SHOP_NAME" value="{$shop_name}" />
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Logo' mod='frakintegration'}</label>
            <div class="col-lg-6">
                <div class="form-group">
                    <label class="control-label">{l s='Logo URL' mod='frakintegration'}</label>
                    <input type="text" name="FRAK_LOGO_URL" id="logo_url_input" value="{$logo_url}" placeholder="{l s='Enter logo URL' mod='frakintegration'}" />
                    {if $logo_url && strpos($logo_url, 'modules/frakintegration/uploads/') !== false}
                        <p class="help-block" style="color: #5cb85c; font-size: 11px;">
                            <i class="icon-check"></i> {l s='Currently using uploaded file' mod='frakintegration'}
                        </p>
                    {/if}
                </div>
                <div class="form-group">
                    <label class="control-label">{l s='Or upload a file' mod='frakintegration'}</label>
                    <input type="file" name="FRAK_LOGO_FILE" id="logo_file_input" accept="image/*" />
                    <p class="help-block">{l s='Supported formats: JPG, PNG, GIF, SVG' mod='frakintegration'}</p>
                </div>
            </div>
            <div class="col-lg-3">
                <div class="logo-preview">
                    <label class="control-label">{l s='Preview' mod='frakintegration'}</label>
                    <div id="logo_preview_container" style="border: 1px solid #ddd; padding: 10px; text-align: center; min-height: 100px; background-color: #f9f9f9;">
                        {if $logo_url}
                            <img id="logo_preview" src="{$logo_url}" alt="Logo preview" style="max-width: 100%; max-height: 80px;" />
                        {else}
                            <p id="no_logo_text" style="color: #999; margin: 30px 0;">{l s='No logo selected' mod='frakintegration'}</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Language' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <select name="FRAK_MODAL_LNG">
                    <option value="default" {if $modal_lng == 'default'}selected="selected"{/if}>{l s='Default' mod='frakintegration'}</option>
                    <option value="en" {if $modal_lng == 'en'}selected="selected"{/if}>{l s='English' mod='frakintegration'}</option>
                    <option value="fr" {if $modal_lng == 'fr'}selected="selected"{/if}>{l s='French' mod='frakintegration'}</option>
                </select>
            </div>
        </div>
        <hr>
        <h4>{l s='Internationalization' mod='frakintegration'}</h4>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Login (referrer)' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_MODAL_I18N[sdk.wallet.login.text_sharing]" value="{if isset($modal_i18n['sdk.wallet.login.text_sharing'])}{$modal_i18n['sdk.wallet.login.text_sharing']}{/if}" />
                <p class="help-block">{l s='Text displayed in the login modal when a user is a referrer.' mod='frakintegration'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Login (referred)' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_MODAL_I18N[sdk.wallet.login.text_referred]" value="{if isset($modal_i18n['sdk.wallet.login.text_referred'])}{$modal_i18n['sdk.wallet.login.text_referred']}{/if}" />
                <p class="help-block">{l s='Text displayed in the login modal when a user is referred.' mod='frakintegration'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Login Button' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_MODAL_I18N[sdk.wallet.login.primaryAction]" value="{if isset($modal_i18n['sdk.wallet.login.primaryAction'])}{$modal_i18n['sdk.wallet.login.primaryAction']}{/if}" />
                <p class="help-block">{l s='Text for the primary action button in the login modal.' mod='frakintegration'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Sharing Title' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_MODAL_I18N[sharing.title]" value="{if isset($modal_i18n['sharing.title'])}{$modal_i18n['sharing.title']}{/if}" />
                <p class="help-block">{l s='Title of the sharing modal.' mod='frakintegration'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Sharing Text' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <input type="text" name="FRAK_MODAL_I18N[sharing.text]" value="{if isset($modal_i18n['sharing.text'])}{$modal_i18n['sharing.text']}{/if}" />
                <p class="help-block">{l s='Text displayed alongside the sharing link.' mod='frakintegration'}</p>
            </div>
        </div>
        <div class="panel-footer">
            <button type="submit" value="1" name="submitFrakModal" class="btn btn-default pull-right">
                <i class="process-icon-save"></i> {l s='Save' mod='frakintegration'}
            </button>
        </div>
    </form>
</div>

<div class="panel">
    <h3><i class="icon icon-cogs"></i> {l s='Frak Webhook Management' mod='frakintegration'}</h3>
    <form id="webhook_form" class="defaultForm form-horizontal" action="{$form_action}" method="post">
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Webhook Secret' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <div class="input-group">
                    <input type="text" name="FRAK_WEBHOOK_SECRET" value="{$webhook_secret}" readonly />
                    <span class="input-group-btn">
                        {if $webhook_secret}
                            <button type="submit" name="generateFrakWebhookSecret" class="btn btn-default" onclick="return confirm('{l s='Are you sure you want to regenerate the webhook secret? This will break the integration if you have already configured it on Frak.' mod='frakintegration'}');">
                                {l s='Regenerate' mod='frakintegration'}
                            </button>
                        {else}
                            <button type="submit" name="generateFrakWebhookSecret" class="btn btn-default">
                                {l s='Generate' mod='frakintegration'}
                            </button>
                        {/if}
                    </span>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Webhook Status' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <p class="form-control-static">
                    {if $webhook_status}
                        <span class="label label-success">{l s='Webhook is set up' mod='frakintegration'}</span>
                    {else}
                        <span class="label label-danger">{l s='Webhook is not set up' mod='frakintegration'}</span>
                    {/if}
                </p>
            </div>
        </div>
        <div class="form-group">
            <label class="control-label col-lg-3">{l s='Manage Webhook' mod='frakintegration'}</label>
            <div class="col-lg-9">
                <a id="open-webhook-popup" href="#" class="btn btn-default">
                    <i class="icon-cog"></i> {l s='Create Webhook' mod='frakintegration'}
                </a>
                <a href="{$frak_product_url}" target="_blank" class="btn btn-default">
                    <i class="icon-external-link"></i> {l s='Manage on Frak' mod='frakintegration'}
                </a>
            </div>
        </div>
    </form>
    <div class="panel-footer">
        <h4>Info</h4>
        <p>Domain: {$domain}</p>
        <p>Product ID: {$product_id}</p>
        <p>Webhook URL: <code>{$webhook_url}</code></p>
    </div>
</div>

<div class="panel">
    <h3><i class="icon icon-bug"></i> {l s='Webhook Debug Information' mod='frakintegration'}</h3>
    
    {* Webhook Statistics *}
    <div class="row">
        <div class="col-lg-12">
            <h4>{l s='Statistics' mod='frakintegration'}</h4>
            <div class="row">
                <div class="col-lg-3">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h3 class="text-primary">{$webhook_stats.total_attempts}</h3>
                            <p>{l s='Total Attempts' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h3 class="text-success">{$webhook_stats.successful}</h3>
                            <p>{l s='Successful' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h3 class="text-danger">{$webhook_stats.failed}</h3>
                            <p>{l s='Failed' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h3 class="text-info">{$webhook_stats.success_rate}%</h3>
                            <p>{l s='Success Rate' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-lg-6">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h4 class="text-warning">{$webhook_stats.avg_response_time}ms</h4>
                            <p>{l s='Average Response Time' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="panel panel-default">
                        <div class="panel-body text-center">
                            <h4 class="text-muted">{if $webhook_stats.last_attempt}{$webhook_stats.last_attempt}{else}{l s='Never' mod='frakintegration'}{/if}</h4>
                            <p>{l s='Last Attempt' mod='frakintegration'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {* Test and Clear Actions *}
    <div class="row">
        <div class="col-lg-12">
            <h4>{l s='Actions' mod='frakintegration'}</h4>
            <form class="form-inline" action="{$form_action}" method="post">
                <button type="submit" name="testFrakWebhook" class="btn btn-primary">
                    <i class="icon-play"></i> {l s='Test Webhook' mod='frakintegration'}
                </button>
                <button type="submit" name="clearFrakWebhookLogs" class="btn btn-warning" onclick="return confirm('{l s='Are you sure you want to clear all webhook logs?' mod='frakintegration'}');">
                    <i class="icon-trash"></i> {l s='Clear Logs' mod='frakintegration'}
                </button>
            </form>
        </div>
    </div>

    {* Recent Webhook Logs *}
    <div class="row">
        <div class="col-lg-12">
            <h4>{l s='Recent Webhook Attempts' mod='frakintegration'}</h4>
            {if $webhook_logs && count($webhook_logs) > 0}
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>{l s='Timestamp' mod='frakintegration'}</th>
                                <th>{l s='Order ID' mod='frakintegration'}</th>
                                <th>{l s='Status' mod='frakintegration'}</th>
                                <th>{l s='HTTP Code' mod='frakintegration'}</th>
                                <th>{l s='Response Time' mod='frakintegration'}</th>
                                <th>{l s='Result' mod='frakintegration'}</th>
                                <th>{l s='Error' mod='frakintegration'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {foreach from=$webhook_logs item=log}
                                <tr class="{if $log.success}success{else}danger{/if}">
                                    <td>{$log.timestamp}</td>
                                    <td>
                                        {if $log.order_id > 0}
                                            <a href="{$link->getAdminLink('AdminOrders')}&id_order={$log.order_id}&vieworder" target="_blank">
                                                #{$log.order_id}
                                            </a>
                                        {else}
                                            {l s='Test' mod='frakintegration'}
                                        {/if}
                                    </td>
                                    <td>{$log.status}</td>
                                    <td>
                                        <span class="label {if $log.http_code >= 200 && $log.http_code < 300}label-success{elseif $log.http_code >= 400}label-danger{else}label-warning{/if}">
                                            {$log.http_code}
                                        </span>
                                    </td>
                                    <td>{$log.execution_time}ms</td>
                                    <td>
                                        {if $log.success}
                                            <span class="label label-success">{l s='Success' mod='frakintegration'}</span>
                                        {else}
                                            <span class="label label-danger">{l s='Failed' mod='frakintegration'}</span>
                                        {/if}
                                    </td>
                                    <td>
                                        {if $log.error}
                                            <span class="text-danger" title="{$log.error}">{$log.error|truncate:50}</span>
                                        {elseif $log.response}
                                            <span class="text-muted" title="{$log.response}">{$log.response|truncate:30}</span>
                                        {else}
                                            -
                                        {/if}
                                    </td>
                                </tr>
                            {/foreach}
                        </tbody>
                    </table>
                </div>
            {else}
                <div class="alert alert-info">
                    {l s='No webhook attempts recorded yet. Webhook logs will appear here after orders are placed or tests are run.' mod='frakintegration'}
                </div>
            {/if}
        </div>
    </div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const styleSelect = document.getElementById('frak_sharing_button_style');
        const customStyleGroup = document.getElementById('frak_sharing_button_custom_style_group');

        styleSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customStyleGroup.style.display = 'block';
            } else {
                customStyleGroup.style.display = 'none';
            }
        });

        const productId = '{$product_id}';
        const webhookSecret = '{$webhook_secret}';

        if (!document.getElementById('open-webhook-popup')) {
            return;
        }

        document.getElementById('open-webhook-popup').addEventListener('click', function(e) {
            e.preventDefault();

            const createUrl = new URL("https://business.frak.id");
            createUrl.pathname = "/embedded/purchase-tracker";
            createUrl.searchParams.append("pid", productId);
            createUrl.searchParams.append("s", webhookSecret);
            createUrl.searchParams.append("p", "custom");

            const openedWindow = window.open(
                createUrl.href,
                "frak-business",
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500,height=800"
            );

            if (openedWindow) {
                openedWindow.focus();

                const timer = setInterval(() => {
                    if (openedWindow.closed) {
                        clearInterval(timer);
                        setTimeout(() => window.location.reload(), 1000);
                    }
                }, 500);
            }
        });

        // Logo preview functionality
        const logoUrlInput = document.getElementById('logo_url_input');
        const logoFileInput = document.getElementById('logo_file_input');
        const logoPreview = document.getElementById('logo_preview');
        const logoPreviewContainer = document.getElementById('logo_preview_container');
        const noLogoText = document.getElementById('no_logo_text');

        function updateLogoPreview(src) {
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
            } else {
                if (logoPreview) {
                    logoPreview.style.display = 'none';
                }
                if (noLogoText) {
                    noLogoText.style.display = 'block';
                }
            }
        }

        if (logoUrlInput) {
            logoUrlInput.addEventListener('input', function() {
                updateLogoPreview(this.value);
                // Clear file input when URL is typed
                if (this.value && logoFileInput) {
                    logoFileInput.value = '';
                }
                // Reset styling when manually typing
                this.style.fontStyle = 'normal';
                this.style.color = '';
            });
        }

        if (logoFileInput) {
            logoFileInput.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        updateLogoPreview(e.target.result);
                    };
                    reader.readAsDataURL(file);
                    // Update the URL input to show that a file is selected
                    if (logoUrlInput) {
                        logoUrlInput.value = '{l s="File will be uploaded: " mod="frakintegration"}' + file.name;
                        logoUrlInput.style.fontStyle = 'italic';
                        logoUrlInput.style.color = '#666';
                    }
                } else {
                    // Reset URL input if no file selected
                    if (logoUrlInput) {
                        logoUrlInput.value = '';
                        logoUrlInput.style.fontStyle = 'normal';
                        logoUrlInput.style.color = '';
                    }
                }
            });
        }
    });
</script>
