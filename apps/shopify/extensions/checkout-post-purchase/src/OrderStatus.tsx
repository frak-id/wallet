import {
    useAppMetafields,
    useAttributeValues,
    useCartLines,
    useOrder,
    useSettings,
    useShop,
} from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { useMemo } from "preact/hooks";
import { extractFrakConfig } from "./frakMetafields";
import { PostPurchaseCard } from "./PostPurchaseCard";

function OrderStatusExtension() {
    const settings = useSettings();
    const [clientId] = useAttributeValues(["_frak-client-id"]);
    const shop = useShop();
    const cartLines = useCartLines();
    const order = useOrder();

    // Read merchantId, walletUrl, logoUrl from shop metafields
    const frakMetafields = useAppMetafields({ namespace: "frak" });
    const frakConfig = useMemo(
        () => extractFrakConfig(frakMetafields),
        [frakMetafields]
    );

    // Map cart lines to product info for the sharing page
    const products = useMemo(
        () =>
            cartLines.map((line) => ({
                title: line.merchandise.title,
                imageUrl: line.merchandise.image?.url,
            })),
        [cartLines]
    );

    // Extract numeric order ID from Shopify GID (e.g. "gid://shopify/Order/123" → "123")
    const orderId = useMemo(() => {
        if (!order?.id) return undefined;
        return order.id.replace(/^gid:\/\/shopify\/Order\//, "");
    }, [order?.id]);

    return (
        <PostPurchaseCard
            settings={settings}
            clientId={clientId}
            shopName={shop.name}
            storefrontUrl={shop.storefrontUrl}
            products={products}
            merchantId={frakConfig.merchantId}
            walletUrl={frakConfig.walletUrl}
            logoUrl={frakConfig.logoUrl}
            orderId={orderId}
        />
    );
}

export default function extension() {
    render(<OrderStatusExtension />, document.body);
}
