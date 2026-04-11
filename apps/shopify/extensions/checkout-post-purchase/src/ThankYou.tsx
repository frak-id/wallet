import {
    useAppMetafields,
    useAttributeValues,
    useCartLines,
    useCheckoutToken,
    useExtensionEditor,
    useSettings,
    useShop,
} from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { useMemo } from "preact/hooks";
import { extractFrakConfig } from "./frakMetafields";
import { PostPurchaseCard } from "./PostPurchaseCard";

function ThankYouExtension() {
    const settings = useSettings();
    const [clientId] = useAttributeValues(["_frak-client-id"]);
    const shop = useShop();
    const cartLines = useCartLines();
    const checkoutToken = useCheckoutToken();
    const editor = useExtensionEditor();

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
    render(<ThankYouExtension />, document.body);
}
