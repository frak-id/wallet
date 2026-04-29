<?php

/**
 * Smarty function plugin registration + handlers for the Frak module.
 *
 * Lets theme files and CMS pages drop `<frak-X>` components anywhere via
 * `{frak_banner}`, `{frak_share_button}`, `{frak_post_purchase}`. Mirrors
 * the WordPress sibling's `[frak_*]` shortcode contract byte-for-byte:
 * snake_case attribute keys are normalised to camelCase at the boundary so
 * templates read naturally (`{frak_banner referral_title="..."}`).
 *
 * Smarty plugins are scoped per-Smarty-instance and registered lazily; we
 * re-register on every module instantiation because PrestaShop instantiates
 * the module per-request anyway via the `header` hook. The
 * unregister/register pair is gated on {@see self::$registered} so it runs
 * at most once per request — PrestaShop news up the module class multiple
 * times per request (header hook, dispatch, admin link) and re-registering
 * the three plugins on every instantiation was wasted work.
 */
class FrakSmartyPlugins
{
    /**
     * Idempotency flag. Set on first registration so subsequent module
     * instantiations within the same request short-circuit. Mirrors
     * WordPress's `Frak_Plugin::init()`-runs-once pattern.
     */
    private static bool $registered = false;

    /**
     * Register the three Smarty function plugins so theme files and CMS
     * pages can drop `<frak-X>` components anywhere.
     *
     * The Smarty instance can be unavailable in CLI / install contexts —
     * we guard with an existence check so a missing context does not blow
     * up the bootstrap. Idempotent across instantiations within the same
     * request via the {@see self::$registered} static flag.
     *
     * @param Context $context Forwarded from the Module instance so the
     *                         helper stays a stateless static call.
     */
    public static function register($context): void
    {
        if (self::$registered) {
            return;
        }
        if (!isset($context->smarty)) {
            return;
        }
        $smarty = $context->smarty;
        if (!is_object($smarty) || !method_exists($smarty, 'registerPlugin')) {
            return;
        }
        // `registerPlugin` throws when called twice for the same name on the
        // same Smarty instance — guard with `unregisterPlugin` so the first
        // module instantiation in the request stays robust against any
        // earlier registration (e.g. another plugin claiming the same name).
        $callbacks = [
            'frak_banner' => [self::class, 'banner'],
            'frak_share_button' => [self::class, 'shareButton'],
            'frak_post_purchase' => [self::class, 'postPurchase'],
        ];
        foreach ($callbacks as $name => $callback) {
            if (method_exists($smarty, 'unregisterPlugin')) {
                @$smarty->unregisterPlugin('function', $name);
            }
            $smarty->registerPlugin('function', $name, $callback);
        }
        self::$registered = true;
    }

    /**
     * `{frak_banner placement="home" referral_title="..."}` Smarty handler.
     *
     * Snake-cases attribute keys at the boundary so merchants can write
     * naturally-readable templates (`referral_title` over `referralTitle`)
     * — mirrors the WordPress shortcode contract.
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function banner(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::banner(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }

    /**
     * `{frak_share_button text="Share & earn" use_reward=1}` Smarty handler.
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function shareButton(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::shareButton(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }

    /**
     * `{frak_post_purchase variant="referrer" cta_text="Earn"}` Smarty handler.
     *
     * Emits the bare `<frak-post-purchase>` markup. Order context
     * (`customer-id` / `order-id` / `token`) is NOT auto-injected here —
     * the auto-render hooks (`displayOrderConfirmation`,
     * `displayOrderDetail`) own that path through
     * {@see FrakOrderHooks::renderPostPurchase()}. Templates that need a
     * tracker on a non-order endpoint should pass the triple explicitly via
     * `customer_id`, `order_id`, `token` parameters (snake_case keys are
     * normalised to camelCase before render).
     *
     * @param array<string, mixed> $params Smarty-supplied attribute pairs.
     * @param mixed                $smarty Smarty instance (unused).
     */
    public static function postPurchase(array $params, $smarty): string
    {
        unset($smarty);
        return FrakComponentRenderer::postPurchase(
            FrakComponentRenderer::snakeKeysToCamel($params)
        );
    }
}
