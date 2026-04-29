<?php

/**
 * Generic placement dispatcher for `display*` hooks.
 *
 * Looks up every placement registered for a given hook, gates each on its
 * bundled-storage flag, and concatenates the rendered markup. The
 * component-specific render paths still live on {@see FrakComponentRenderer}
 * (banner / share button) or {@see FrakOrderRender::postPurchase()}
 * (post-purchase + Smarty wrapper); this class is just the routing layer.
 *
 * `FrakPlacementRegistry::isEnabled()` resolves through a per-request static
 * cache, so a page firing multiple display hooks (e.g. a product page with
 * `displayTop` + `displayProductAdditionalInfo` + `displayShoppingCart`)
 * only decodes the bundled storage row once.
 *
 * Extracted from `FrakIntegration::dispatchHook()` so the Module bootstrap
 * stays a thin router.
 */
class FrakDisplayDispatcher
{
    /**
     * @param Module               $module FrakIntegration instance — forwarded to
     *                                     {@see FrakOrderRender::postPurchase()}
     *                                     so it can call `$module->display()` and
     *                                     `$module->context->smarty->assign()`.
     * @param string               $hook   PrestaShop hook name, e.g. `displayTop`.
     * @param array<string, mixed> $params Hook parameters forwarded by PrestaShop.
     */
    public static function dispatch(Module $module, string $hook, array $params = []): string
    {
        $output = '';
        foreach (FrakPlacementRegistry::forHook($hook) as $id => $placement) {
            if (!FrakPlacementRegistry::isEnabled($id)) {
                continue;
            }
            switch ($placement['component']) {
                case FrakPlacementRegistry::COMPONENT_BANNER:
                    $output .= FrakComponentRenderer::banner([
                        'placement' => $placement['placement_attr'],
                    ]);
                    break;
                case FrakPlacementRegistry::COMPONENT_SHARE_BUTTON:
                    $output .= FrakComponentRenderer::shareButton([
                        'placement' => $placement['placement_attr'],
                    ]);
                    break;
                case FrakPlacementRegistry::COMPONENT_POST_PURCHASE:
                    $output .= FrakOrderRender::postPurchase(
                        $module,
                        $params['order'] ?? null,
                        $placement['placement_attr']
                    );
                    break;
            }
        }
        return $output;
    }
}
