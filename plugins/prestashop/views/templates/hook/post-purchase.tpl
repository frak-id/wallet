{*
 * Theme-overridable wrapper for `<frak-post-purchase>` and its inline
 * tracker `<script>`.
 *
 * Override path:
 *   themes/<theme>/modules/frakintegration/views/templates/hook/post-purchase.tpl
 *
 * Overriding lets merchants tweak the surrounding markup (extra wrapping
 * div, additional CSS classes, layout adjustments) without forking the
 * module. The pre-rendered HTML inside `$frak_post_purchase_html` includes
 * both the web component and the inline tracker script — both must be
 * preserved for attribution to work, so the variable is rendered as-is via
 * `nofilter`. The output is already escaped at the PHP boundary by
 * {@see FrakComponentRenderer}.
 *}
<div class="frak-post-purchase-wrapper">
    {$frak_post_purchase_html nofilter}
</div>
