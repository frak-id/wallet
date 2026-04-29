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
 * `displayTop` + `displayProductAdditionalInfo`)
 * only decodes the bundled storage row once.
 *
 * Extracted from `FrakIntegration::dispatchHook()` so the Module bootstrap
 * stays a thin router.
 */
class FrakDisplayDispatcher
{
    /**
     * @param Module               $module FrakIntegration instance — forwarded to
     *                                     {@see FrakOrderRender::postPurchase()} so it can call
     *                                     `$module->display()` for the Smarty wrapper. Smarty
     *                                     assignments go through `Context::getContext()` because
     *                                     `Module::$context` is `protected`.
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
            // Merchant-tunable per-placement options (button style preset, banner
            // CSS class) flow through the registry as a `{key: value}` map keyed
            // by the camelCase renderer attribute. Splatting them into the attrs
            // array means future option additions are zero-touch on this site —
            // declare the schema entry on the placement and the dispatcher already
            // forwards it.
            $options = FrakPlacementRegistry::getOptions($id);
            switch ($placement['component']) {
                case FrakPlacementRegistry::COMPONENT_BANNER:
                    $output .= FrakComponentRenderer::banner(array_merge($options, [
                        'placement' => $placement['placement_attr'],
                    ]));
                    break;
                case FrakPlacementRegistry::COMPONENT_SHARE_BUTTON:
                    $output .= FrakComponentRenderer::shareButton(array_merge($options, [
                        'placement' => $placement['placement_attr'],
                    ]));
                    break;
                case FrakPlacementRegistry::COMPONENT_POST_PURCHASE:
                    $output .= FrakOrderRender::postPurchase(
                        $module,
                        $params['order'] ?? null,
                        $placement['placement_attr'],
                        $options
                    );
                    break;
            }
        }
        return $output;
    }
}
