import {
    useApi,
    useAppMetafields,
    useAttributeValues,
    useCartLines,
    useExtensionEditor,
    useSettings,
    useShop,
    useSubscription,
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
    const editor = useExtensionEditor();
    // Subscribe to the checkout token — correlates with the web pixel payload
    // and gives the backend an identifier for the purchase.
    const api = useApi<"customer-account.order-status.block.render">();
    const checkoutToken = useSubscription(api.checkoutToken);

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
                link: `${shop.storefrontUrl}/variants/${line.merchandise.id.split("/").pop()}`,
            })),
        [cartLines]
    );

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
            checkoutToken={checkoutToken ?? undefined}
            redirectUrl={shop.storefrontUrl}
            isEditor={Boolean(editor)}
        />
    );
}

export default function extension() {
    render(<OrderStatusExtension />, document.body);
}
