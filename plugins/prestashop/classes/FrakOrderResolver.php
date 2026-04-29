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
            'token' => self::buildToken($order),
        ];
    }

    /**
     * Server-side webhook payload for `POST /ext/merchant/{id}/webhook/custom`.
     *
     * Single-pass extraction of every field the backend's `customWebhook` DTO
     * expects: order id + customer + status + opaque token + currency + total +
     * line items. Centralised here (rather than on {@see FrakWebhookHelper})
     * so PrestaShop entity knowledge — `Order::getProducts()`, `Customer`,
     * `Currency` — lives in one resolver, and the webhook helper stays a
     * pure transport class.
     *
     * Fail-loud on missing customer / currency / line items: malformed orders
     * shouldn't silently dispatch a partial payload to the backend. The hook
     * caller catches and routes the exception into the retry queue.
     *
     * @param Order  $order  Loaded PrestaShop order object.
     * @param string $status Mapped Frak status (`pending|confirmed|cancelled|refunded`).
     * @return array{id:int,customerId:int,status:string,token:string,currency:string,totalPrice:float,items:array<int,array{productId:int,quantity:int,price:float,name:string,title:string}>}
     */
    public static function getWebhookPayload($order, string $status): array
    {
        if (!Validate::isLoadedObject($order)) {
            throw new Exception('Order not loaded');
        }

        $customer = new Customer($order->id_customer);
        if (!Validate::isLoadedObject($customer)) {
            throw new Exception('Customer not found for order: ' . $order->id);
        }

        $currency = new Currency($order->id_currency);
        if (!Validate::isLoadedObject($currency)) {
            throw new Exception('Currency not found for order: ' . $order->id);
        }

        $products = $order->getProducts();
        if (empty($products)) {
            throw new Exception('No products found for order: ' . $order->id);
        }

        $items = [];
        foreach ($products as $product) {
            $items[] = [
                'productId' => $product['product_id'],
                'quantity' => $product['product_quantity'],
                'price' => $product['unit_price_tax_incl'],
                'name' => $product['product_name'],
                'title' => $product['product_name'],
            ];
        }

        return [
            'id' => (int) $order->id,
            'customerId' => (int) $customer->id,
            'status' => $status,
            'token' => self::buildToken($order),
            'currency' => $currency->iso_code,
            'totalPrice' => $order->total_paid_tax_incl,
            'items' => $items,
        ];
    }

    /**
     * Build the opaque per-order token used by both the SDK component
     * (`<frak-post-purchase token="…">`) and the backend webhook payload.
     *
     * Format: `{secure_key}_{orderId}` — the cart `secure_key` is
     * PrestaShop's per-cart MD5 anti-tamper handle; appending the order id
     * matches the WordPress / Magento siblings' contract so the backend
     * has a single token shape across all three plugins.
     *
     * Centralised here so {@see getContext()} (SDK component) and
     * {@see getWebhookPayload()} (backend webhook) cannot drift on the
     * concatenation order — a regression that would silently break
     * attribution for the affected channel.
     *
     * @param Order $order Loaded PrestaShop order object.
     */
    private static function buildToken($order): string
    {
        return $order->secure_key . '_' . $order->id;
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
