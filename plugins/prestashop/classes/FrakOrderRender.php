<?php

/**
 * Order-page rendering glue for the Frak PrestaShop module.
 *
 * Owns the markup emitted on `displayOrderConfirmation` and
 * `displayOrderDetail`:
 *   - Always-on `trackPurchaseStatus` `<script>` (fired regardless of
 *     placement state so attribution keeps working when the merchant
 *     disables the post-purchase card).
 *   - Opt-in `<frak-post-purchase>` card wrapped in a theme-overridable
 *     Smarty partial (rendered through {@see FrakDisplayDispatcher}).
 *
 * Mirrors WordPress's `Frak_WooCommerce::render_purchase_tracker_for_order`
 * + post-purchase block render path. Both plugins emit the same
 * `(customerId, orderId, token)` payload so the backend has one contract
 * to maintain.
 *
 * Split out from the legacy `FrakOrderHooks` class so server-side webhook
 * orchestration ({@see FrakOrderWebhook}) and client-side rendering live
 * in separate translation units.
 */
class FrakOrderRender
{
    /**
     * Always-on inline tracker for the order-confirmation and order-detail
     * hooks. Emits the `<script>` that calls `trackPurchaseStatus` once the
     * SDK client is ready, regardless of whether the visible
     * `<frak-post-purchase>` component placement is enabled — so disabling
     * the card via the placement registry never breaks attribution.
     *
     * The `<frak-post-purchase>` component (when present) ALSO calls
     * `trackPurchaseStatus` on mount; the SDK is idempotent on the
     * `(customerId, orderId, token)` triple so the duplicate call when both
     * surfaces fire is intentional and safe.
     *
     * Returns an empty string on missing / unloaded orders so the hook is a
     * no-op for malformed dispatches — same guard shape as
     * {@see self::postPurchase()}.
     *
     * @param mixed $order Resolved Order object from the hook params.
     */
    public static function purchaseTracker($order): string
    {
        if (!$order || !Validate::isLoadedObject($order)) {
            return '';
        }
        return FrakComponentRenderer::purchaseTrackerScript(
            FrakOrderResolver::getContext($order)
        );
    }

    /**
     * Render the opt-in `<frak-post-purchase>` card for the order-confirmation
     * and order-detail hooks. Resolves the SDK context + product list once via
     * {@see FrakOrderResolver}, builds the component markup, and hands it to
     * the Smarty wrapper partial so themes can override the surrounding markup
     * without breaking the component contract.
     *
     * The inline tracker `<script>` is NOT emitted from here — it is fired
     * independently by {@see self::purchaseTracker()} on every order-page
     * hook dispatch so attribution keeps working even when the merchant
     * disables the post-purchase placement toggle.
     *
     * Returns an empty string on missing / unloaded orders so the hook is a
     * no-op for malformed dispatches (PrestaShop generally guarantees a valid
     * Order object on these hooks, but the guard is cheap and keeps phpstan
     * happy).
     *
     * @param Module $module    FrakIntegration instance — needed for
     *                          `$module->display()` (Smarty wrapper) and
     *                          `$module->context->smarty->assign()`.
     * @param mixed  $order     Resolved Order object from the hook params.
     * @param string $placement Placement identifier forwarded to the SDK.
     */
    public static function postPurchase(Module $module, $order, string $placement): string
    {
        if (!$order || !Validate::isLoadedObject($order)) {
            return '';
        }

        $data = FrakOrderResolver::getPostPurchaseData($order);

        $attrs = $data['context'] + ['placement' => $placement];
        if ($data['products'] !== null) {
            $products_json = json_encode($data['products'], FrakComponentRenderer::JSON_FLAGS);
            if (is_string($products_json)) {
                $attrs['products'] = $products_json;
            }
        }

        $html = FrakComponentRenderer::postPurchase($attrs);

        $module->context->smarty->assign('frak_post_purchase_html', $html);
        // `$module->getLocalPath() . $module->name . '.php'` resolves to the
        // module bootstrap file. PrestaShop's `Module::display()` uses the
        // first arg only to derive the module slug for template lookups, so
        // any path inside the module dir works — but matching the bootstrap
        // file makes the call site read identically to the legacy in-class
        // `$this->display(__FILE__, ...)` it replaces.
        return $module->display(
            $module->getLocalPath() . $module->name . '.php',
            'views/templates/hook/post-purchase.tpl'
        );
    }
}
