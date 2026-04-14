import { useMemo } from "preact/hooks";

const DEFAULT_MESSAGE = "Earn rewards through sharing";
const DEFAULT_DESCRIPTION = "If they buy, they earn... and so do you!";
const DEFAULT_CTA = "Share & earn";
const DEFAULT_WALLET_URL = "https://wallet.frak.id";

const GIFT_SVG_DATA_URI =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzgiIGN5PSIyOCIgcj0iMjMiIGZpbGw9IiNGRkY1MzMiLz48cGF0aCBkPSJNNTAgMzhDMzAgMTAgMTIgMzAgNTAgMzhaIiBzdHJva2U9IiMyMjIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTUwIDM4QzcwIDEwIDg4IDMwIDUwIDM4WiIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxyZWN0IHg9IjEwIiB5PSIzOCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjE2IiByeD0iMiIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjQiLz48cGF0aCBkPSJNMTUgNTRWODlDMTUgOTAuNiAxNi40IDkyIDE4IDkySDgyQzgzLjYgOTIgODUgOTAuNiA4NSA4OVY1NCIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxsaW5lIHgxPSI1MCIgeTE9IjU0IiB4Mj0iNTAiIHkyPSI5MiIgc3Ryb2tlPSIjMjIyIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==";

const FRAK_LOGO_DATA_URI =
    "data:image/svg+xml,%3csvg%20width='73'%20height='28'%20viewBox='0%200%2073%2028'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M9.59332%2021.7692L0.358405%2018.6439C0.182592%2018.5842%200%2018.7153%200%2018.901V24.603C0%2024.7196%200.0741217%2024.8226%200.1844%2024.8601L9.41932%2027.9854C9.59513%2028.0451%209.77772%2027.914%209.77772%2027.7283V22.0263C9.77772%2021.9097%209.7036%2021.8067%209.59332%2021.7692ZM19.1993%2010.8344L9.96212%2013.9597C9.85184%2013.9972%209.77772%2014.1003%209.77772%2014.2169V19.9188C9.77772%2020.1046%209.96031%2020.2357%2010.1361%2020.176L19.3733%2017.0507C19.4836%2017.0132%2019.5577%2016.9101%2019.5577%2016.7935V11.0916C19.5577%2010.9058%2019.3756%2010.7748%2019.1993%2010.8344ZM27.8738%200.00860862L12.4095%204.98922C12.2974%205.02537%2012.2215%205.12978%2012.2215%205.24774V11.0898C12.2215%2011.2059%2012.3367%2011.2882%2012.4488%2011.252L27.9131%206.27143C28.0252%206.23527%2028.1016%206.13087%2028.1016%206.01291V0.170862C28.1011%200.0547085%2027.9859%20-0.0275482%2027.8738%200.00860862Z'%20fill='%230043EF'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M59.9645%2010.797C60.0989%2010.7972%2060.2077%2010.9067%2060.2077%2011.0411L60.1159%2021.9894C60.1159%2022.1198%2060.0113%2022.2257%2059.8825%2022.2257L59.862%2022.2218H58.1384C57.9443%2022.2217%2057.466%2022.0473%2056.9645%2021.7257C56.2787%2022.0451%2055.5169%2022.2257%2054.7155%2022.2257H54.3893C52.9029%2022.2257%2051.5529%2021.6119%2050.5749%2020.6232C49.596%2019.6344%2048.9899%2018.2686%2048.9899%2016.7648C48.99%2015.2612%2049.597%2013.896%2050.5749%2012.9074C51.5165%2011.9558%2052.8042%2011.3535%2054.2253%2011.3097C55.3931%2011.2404%2056.4444%2011.4093%2057.0915%2012.0646V11.0411C57.0915%2010.9066%2057.2001%2010.797%2057.3347%2010.797H59.9645ZM37.6052%205.78236H39.6774C39.8391%205.78241%2039.9707%205.9139%2039.9723%206.07728V8.60658C39.9723%208.76909%2039.8401%208.90039%2039.6784%208.90052H37.0485C36.2694%208.90059%2035.3845%209.66894%2035.3845%2010.462V12.2179C36.2024%2011.3992%2037.0604%2010.98%2037.6052%2010.9503H39.0319C39.1944%2010.9503%2039.3257%2011.0817%2039.3259%2011.2433V13.7745C39.3257%2013.937%2039.1936%2014.0685%2039.0319%2014.0685H37.0475C36.2685%2014.0687%2035.3835%2014.8369%2035.3835%2015.63V21.9816C35.3834%2022.116%2035.2748%2022.2247%2035.1403%2022.2247H32.5104C32.3762%2022.2245%2032.2674%2022.1159%2032.2673%2021.9816V11.3458C32.2673%2011.2577%2032.2564%2011.1704%2032.2604%2011.0831C32.3108%209.97883%2032.1975%205.56034%2037.6052%205.78236ZM43.5016%2010.9503C43.6362%2010.9503%2043.7458%2011.0599%2043.7458%2011.1945V12.2179C44.5636%2011.3993%2045.627%2010.9504%2045.9655%2010.9503H48.0378C48.1994%2010.9503%2048.3317%2011.0817%2048.3327%2011.2433V13.7736C48.3326%2013.9361%2048.2005%2014.0675%2048.0388%2014.0675H45.4089C44.6299%2014.0678%2043.7458%2014.836%2043.7458%2015.629V21.9816C43.7457%2022.116%2043.6361%2022.2247%2043.5016%2022.2247H40.8727C40.7383%2022.2247%2040.6287%2022.116%2040.6286%2021.9816V11.1945C40.6286%2011.0599%2040.7382%2010.9503%2040.8727%2010.9503H43.5016ZM64.4382%207.5724C64.5743%207.5724%2064.6862%207.68344%2064.6862%207.82045V15.8644L69.1159%2011.6691C69.1621%2011.6253%2069.2223%2011.6007%2069.2858%2011.6007H72.2702C72.4897%2011.6008%2072.6004%2011.8657%2072.447%2012.0216L68.4372%2016.1017L72.9391%2021.8214C73.067%2021.9839%2072.9519%2022.2216%2072.7458%2022.2218H69.6423C69.5672%2022.2218%2069.4969%2022.1876%2069.4499%2022.129L66.3395%2018.2687C66.2463%2018.1557%2066.0764%2018.1462%2065.9723%2018.2492L64.6862%2019.5177V21.9747C64.6862%2022.1109%2064.5752%2022.2228%2064.4382%2022.2228H61.8532C61.7171%2022.2227%2061.6061%2022.1117%2061.6061%2021.9747V7.82045C61.6061%207.68434%2061.7163%207.57253%2061.8532%207.5724H64.4382ZM54.3639%2013.9503C53.604%2013.9504%2052.9125%2014.2653%2052.4108%2014.7736C51.9083%2015.2819%2051.5965%2015.9809%2051.5964%2016.7492C51.5964%2017.5175%2051.9082%2018.2181%2052.4108%2018.7257C52.9125%2019.2339%2053.604%2019.5489%2054.3639%2019.549H54.7389C55.4983%2019.549%2056.1912%2019.2341%2056.6931%2018.7257C57.1956%2018.2181%2057.5075%2017.5175%2057.5075%2016.7492C57.5074%2015.981%2057.1955%2015.2811%2056.6931%2014.7736C56.1912%2014.2652%2055.4983%2013.9503%2054.7389%2013.9503H54.3639Z'%20fill='black'/%3e%3c/svg%3e";

/**
 * Extension settings configured by merchants in the Checkout Editor.
 * Only text customization — merchantId/walletUrl/logoUrl come from metafields.
 */
type PostPurchaseSettings = {
    sharing_url?: string;
    message?: string;
    description?: string;
    cta_text?: string;
    badge_text?: string;
};

type ProductInfo = {
    title: string;
    imageUrl?: string;
};

function constructSharingUrl({
    walletUrl,
    merchantId,
    sharingUrl,
    clientId,
    shopName,
    logoUrl,
    products,
    checkoutToken,
    redirectUrl,
}: {
    walletUrl: string;
    merchantId: string;
    sharingUrl: string;
    clientId?: string;
    shopName?: string;
    logoUrl?: string;
    products?: ProductInfo[];
    checkoutToken?: string;
    redirectUrl?: string;
}) {
    const url = new URL(`${walletUrl}/sharing`);
    url.searchParams.set("merchantId", merchantId);
    url.searchParams.set("link", sharingUrl);
    if (clientId) {
        url.searchParams.set("clientId", clientId);
    }
    if (shopName) {
        url.searchParams.set("appName", shopName);
    }
    if (logoUrl) {
        url.searchParams.set("logoUrl", logoUrl);
    }
    if (products && products.length > 0) {
        url.searchParams.set("products", JSON.stringify(products));
    }
    if (checkoutToken) {
        url.searchParams.set("checkoutToken", checkoutToken);
    }
    if (redirectUrl) {
        url.searchParams.set("redirectUrl", redirectUrl);
    }
    return url.toString();
}

/**
 * Post-purchase sharing card component.
 *
 * Renders on both the Thank You and Order Status pages.
 * Constructs a URL to the external Frak sharing page and displays
 * a card with badge, heading, description, CTA button, and a
 * decorative gift icon — opening the sharing page in a new tab.
 *
 * Purchase tracking is handled separately by the checkout web pixel.
 *
 * Configuration sources:
 *  - merchantId, walletUrl, logoUrl → auto-read from shop metafields (frak.*)
 *  - sharing_url → extension setting (merchant configures in Checkout Editor)
 *  - text fields → extension settings with sensible defaults
 *
 * Renders `null` in production when required data (merchantId or sharingUrl) is
 * missing, so the card never shows a broken CTA. In the Checkout Editor, falls
 * back to a disabled preview card so merchants can customize text settings.
 */
export function PostPurchaseCard({
    settings,
    clientId,
    shopName,
    storefrontUrl,
    products,
    merchantId,
    walletUrl,
    logoUrl,
    checkoutToken,
    redirectUrl,
    isEditor,
}: {
    settings: Partial<PostPurchaseSettings>;
    clientId?: string;
    shopName?: string;
    /** Shop storefront URL — fallback when sharing_url setting is empty */
    storefrontUrl?: string;
    products?: ProductInfo[];
    /** From frak.merchant_id shop metafield */
    merchantId?: string;
    /** From frak.wallet_url shop metafield */
    walletUrl?: string;
    /** From frak.appearance shop metafield */
    logoUrl?: string;
    /** Checkout token (available on ThankYou surface, correlates with web pixel data) */
    checkoutToken?: string;
    /** URL to redirect the user back to after sharing (e.g. storefront) */
    redirectUrl?: string;
    /** True when rendering inside the Shopify Checkout/Customer Account editor */
    isEditor?: boolean;
}) {
    const sharingUrl = settings.sharing_url || storefrontUrl;
    const resolvedWalletUrl = walletUrl || DEFAULT_WALLET_URL;
    const message = settings.message || DEFAULT_MESSAGE;
    const description = settings.description || DEFAULT_DESCRIPTION;
    const ctaText = settings.cta_text || DEFAULT_CTA;
    const badgeText = settings.badge_text;

    // Build external sharing page URL with all params
    const sharingPageUrl = useMemo(() => {
        if (isEditor) return "#";
        if (!sharingUrl || !merchantId) return null;

        return constructSharingUrl({
            walletUrl: resolvedWalletUrl,
            merchantId,
            sharingUrl,
            clientId,
            shopName,
            logoUrl,
            products,
            checkoutToken,
            redirectUrl,
        });
    }, [
        resolvedWalletUrl,
        merchantId,
        sharingUrl,
        clientId,
        shopName,
        logoUrl,
        products,
        checkoutToken,
        redirectUrl,
    ]);

    // In production, hide the card when required data is missing to avoid a
    // broken CTA. In the editor, keep rendering so merchants can preview and
    // customize their text settings — the button is disabled in that case.
    if (!sharingPageUrl) return null;

    return (
        <s-box
            background="base"
            borderRadius="base"
            border="base"
            padding="large"
        >
            <s-grid gridTemplateColumns="1fr 80px" gap="base" alignItems="end">
                {/* Left column — text content & CTA */}
                <s-stack direction="block" gap="small">
                    {badgeText && <s-badge size="base">{badgeText}</s-badge>}
                    <s-heading>{message}</s-heading>
                    <s-text color="subdued">{description}</s-text>
                    <s-button
                        variant="primary"
                        href={sharingPageUrl}
                        target="_blank"
                    >
                        {ctaText}
                    </s-button>
                </s-stack>

                {/* Right column — gift icon + frak branding */}
                <s-stack direction="block" alignItems="end">
                    <s-grid gridTemplateColumns="80px">
                        <s-image
                            src={GIFT_SVG_DATA_URI}
                            alt="Gift"
                            aspectRatio="1"
                            inlineSize="fill"
                            objectFit="contain"
                            loading="eager"
                        />
                    </s-grid>
                    <s-grid gridTemplateColumns="40px">
                        <s-image
                            src={FRAK_LOGO_DATA_URI}
                            alt="frak"
                            inlineSize="fill"
                            objectFit="contain"
                            loading="eager"
                        />
                    </s-grid>
                </s-stack>
            </s-grid>
        </s-box>
    );
}
