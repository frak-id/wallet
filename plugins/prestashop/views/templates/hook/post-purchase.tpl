{*
 * Theme-overridable wrapper for `<frak-post-purchase>`.
 *
 * Override path:
 *   themes/<theme>/modules/frakintegration/views/templates/hook/post-purchase.tpl
 *
 * Overriding lets merchants tweak the surrounding markup (extra wrapping
 * div, additional CSS classes, layout adjustments) without forking the
 * module. The pre-rendered HTML inside `$frak_post_purchase_html` is the
 * `<frak-post-purchase>` web component markup only — already escaped at the
 * PHP boundary by {@see FrakComponentRenderer}, so it is rendered as-is via
 * `nofilter`.
 *
 * The inline `trackPurchaseStatus` `<script>` is emitted independently by
 * the order hooks (always-on, even when the post-purchase placement is
 * disabled) so overriding or removing this template never breaks
 * attribution.
 *}
<div class="frak-post-purchase-wrapper">
    {$frak_post_purchase_html nofilter}
</div>
