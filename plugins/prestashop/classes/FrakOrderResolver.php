<?php

/**
 * Resolves all server-side data needed by `<frak-post-purchase>` from a
 * PrestaShop {@see Order} object: customer/order/token context plus optional
 * line-item data for the SDK's sharing-page UI.
 *
 * Sibling of WordPress's `Frak_WooCommerce::get_post_purchase_data()`. Kept
 * deliberately parallel so both plugins emit the same `<frak-post-purchase>`
 * payload shape and the backend has one contract to maintain.
 *
 * Stateless static class. The hooks (`displayOrderConfirmation` /
 * `displayOrderDetail`) already receive a resolved `Order`, so no per-request
 * caching is needed — every call site has direct access to the object.
 */
class FrakOrderResolver
{
    /**
     * Default cap on the number of order line items forwarded to the
     * `<frak-post-purchase products>` HTML attribute. Big carts would
     * otherwise serialise to multi-kilobyte attribute values; the sharing
     * page UI also gets cluttered past ~6 items. Mirrors the WordPress
     * plugin's `Frak_WooCommerce::DEFAULT_PRODUCT_CAP`.
     *
     * @var int
     */
    private const DEFAULT_PRODUCT_CAP = 6;

    /**
     * Single-pass resolution: returns both the SDK context (customer-id /
     * order-id / token) and the optional product list in one call.
     *
     * Returned shape:
     *   - `context`  : map of camelCase keys (customerId / orderId / token).
     *                  Always present.
     *   - `products` : list of `{ title, imageUrl?, link? }` arrays, or `null`
     *                  when the order has zero resolvable line items.
     * @param Order $order PrestaShop Order object resolved by the calling hook.
     * @return array{context: array<string, string>, products: list<array{title: string, imageUrl?: string, link?: string}>|null}
     */
    public static function getPostPurchaseData($order, int $cap = self::DEFAULT_PRODUCT_CAP): array
    {
        return [
            'context' => self::getContext($order),
            'products' => self::extractProducts($order, $cap),
        ];
    }

    /**
     * Build the customer/order/token triple consumed by both the
     * `<frak-post-purchase>` HTML attributes and the inline tracker script.
     *
     * `secure_key` is PrestaShop's per-cart MD5 token; combined with the
     * order id it becomes the same anti-tamper opaque token shape used by
     * the WooCommerce / Magento integrations on the backend.
     * @param Order $order PrestaShop Order object resolved by the calling hook.
     * @return array{customerId: string, orderId: string, token: string}
     */
    public static function getContext($order): array
    {
        return [
            'customerId' => (string) $order->id_customer,
            'orderId' => (string) $order->id,
            'token' => $order->secure_key . '_' . $order->id,
        ];
    }

    /**
     * Extract line items as `{ title, imageUrl?, link? }` entries.
     *
     * Uses {@see Order::getProducts()} which already enriches each row with
     * the cover {@see Image} object and `link_rewrite` slug — no extra DB
     * round-trips needed (one of the perf wins called out in the PrestaShop
     * docs vs `Order::getProductsDetail()` followed by per-product lookups).
     *
     * Fail-soft on each row:
     *   - Missing image / unresolvable image URL → `imageUrl` omitted.
     *   - Missing or unresolvable permalink (e.g. deleted product) →
     *     `link` omitted, but the row is still kept because
     *     `order_detail.product_name` is denormalised and remains valid.
     *
     * Returns `null` when the order has no line items at all, or when
     * none of them resolved a non-empty `title`.
     * @param Order $order PrestaShop Order object resolved by the calling hook.
     * @return list<array{title: string, imageUrl?: string, link?: string}>|null
     */
    private static function extractProducts($order, int $cap): ?array
    {
        $rows = $order->getProducts();
        if (empty($rows)) {
            return null;
        }

        $link = Context::getContext()->link;
        $products = [];
        $count = 0;

        foreach ($rows as $row) {
            if ($count >= $cap) {
                break;
            }

            $title = isset($row['product_name']) ? (string) $row['product_name'] : '';
            if ($title === '') {
                continue;
            }

            $entry = ['title' => $title];

            if (
                !empty($row['image'])
                && $row['image'] instanceof Image
                && !empty($row['link_rewrite'])
            ) {
                $image_url = $link->getImageLink(
                    $row['link_rewrite'],
                    (int) $row['image']->id,
                    'home_default'
                );
                if (is_string($image_url) && $image_url !== '') {
                    $entry['imageUrl'] = $image_url;
                }
            }

            if (!empty($row['product_id']) && !empty($row['link_rewrite'])) {
                $permalink = $link->getProductLink(
                    (int) $row['product_id'],
                    $row['link_rewrite']
                );
                if (is_string($permalink) && $permalink !== '') {
                    $entry['link'] = $permalink;
                }
            }

            $products[] = $entry;
            $count++;
        }

        return $products !== [] ? $products : null;
    }
}
