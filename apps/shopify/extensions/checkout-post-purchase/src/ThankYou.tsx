import {
    useApi,
    useAppMetafields,
    useAttributeValues,
    useCartLines,
    useCheckoutToken,
    useExtensionEditor,
    useLanguage,
    useSettings,
    useShop,
    useTranslate,
} from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { useMemo } from "preact/hooks";
import { usePostPurchaseTextOverrides } from "./frakI18n";
import { extractFrakConfig } from "./frakMetafields";
import { PostPurchaseCard } from "./PostPurchaseCard";

function ThankYouExtension() {
    const settings = useSettings();
    const [clientId] = useAttributeValues(["_frak-client-id"]);
    const shop = useShop();
    const cartLines = useCartLines();
    const checkoutToken = useCheckoutToken();
    const editor = useExtensionEditor();
    const t = useTranslate();
    const language = useLanguage();
    const { query } = useApi<"purchase.thank-you.block.render">();

    // Read merchantId, walletUrl, logoUrl from shop metafields
    const frakMetafields = useAppMetafields({ namespace: "frak" });
    const frakConfig = useMemo(
        () => extractFrakConfig(frakMetafields),
        [frakMetafields]
    );

    // Per-locale text overrides come from the frak_i18n metaobject via
    // the Storefront API — useAppMetafields can't resolve metaobject
    // references, so we query directly. The Storefront API resolves the
    // buyer's locale via @inContext (language code passed in the query).
    const textOverrides = usePostPurchaseTextOverrides(query, language.isoCode);

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
            textOverrides={textOverrides}
            defaults={{
                message: t("message"),
                description: t("description"),
                cta: t("cta"),
            }}
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
