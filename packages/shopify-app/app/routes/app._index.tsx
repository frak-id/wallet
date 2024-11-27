import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useRouteLoaderData } from "@remix-run/react";
import {
    BlockStack,
    Button,
    Card,
    Layout,
    Link,
    List,
    Page,
    Text,
} from "@shopify/polaris";
import { WalletGated } from "app/components/WalletGated";
import type { loader as appLoader } from "app/routes/app";
import { firstProductPublished, shopInfo } from "app/services.server/shop";
import { ShopInfo } from "../components/ShopInfo";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const shop = await shopInfo(context);
    const firstProduct = await firstProductPublished(context);
    return {
        shop,
        firstProduct,
        APP_THEME_ID: process.env.SHOPIFY_THEME_COMPONENTS_ID,
    };
};

/**
 * todo: Index page of the Frak application on the shopify admin panel
 *  - Login with a Frak wallet if needed
 *  - Check if a product is present, otherwise, link to product page?
 *  - Quickly check product status? Active campaign etc? And redirect to business for more infos?
 *  - Setup pixel + webhook automatically?
 *
 *
 *  todo:
 *   - theme app extensions for the frak-setup js asset? https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
 * @param request
 */
export default function Index() {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const isThemeSupported = rootData?.isThemeSupported;

    return (
        <Page
            title="Frak configuration"
            primaryAction={
                <Button
                    variant="primary"
                    url={process.env.BUSINESS_URL}
                    target="_blank"
                >
                    Go to dashboard
                </Button>
            }
        >
            <BlockStack gap="500">
                <Layout>
                    {!isThemeSupported && <ThemeNotSupported />}
                    {isThemeSupported && <ThemeSupported />}
                </Layout>
            </BlockStack>
        </Page>
    );
}

function ThemeNotSupported() {
    return (
        <Layout.Section>
            <Text as="p" variant="bodyMd">
                It looks like your theme does not fully support the
                functionality of this app.
            </Text>
            <Text as="p" variant="bodyMd">
                Try switching to a different theme or contacting your theme
                developer to request support.
            </Text>
        </Layout.Section>
    );
}

function ThemeSupported() {
    const { shop, firstProduct, APP_THEME_ID } = useLoaderData<typeof loader>();
    const editorUrl = `https://${shop.myshopifyDomain}/admin/themes/current/editor`;

    return (
        <>
            <Layout.Section>
                <Card>
                    <BlockStack gap="500">
                        <WalletGated>
                            <Text as="p" variant="bodyMd">
                                Ready to manage your product
                            </Text>

                            <List type="number">
                                <List.Item>
                                    <Link url={"/app/pixel"}>
                                        Setup Frak application pixel
                                    </Link>
                                </List.Item>
                                <List.Item>
                                    <Link url={"/app/webhook"}>
                                        Enable Frak webhook for purchase
                                        tracking
                                    </Link>
                                </List.Item>
                                <List.Item>
                                    <Link
                                        url={`${editorUrl}?context=apps&appEmbed=${APP_THEME_ID}/listener`}
                                        target="_blank"
                                    >
                                        Setup Frak embeded app within your theme
                                    </Link>
                                </List.Item>
                                <List.Item>
                                    {firstProduct ? (
                                        <Link
                                            url={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                                            target="_blank"
                                        >
                                            Add the sharing button where you
                                            want
                                        </Link>
                                    ) : (
                                        <>
                                            You need to add a product to your
                                            store to add the sharing button
                                        </>
                                    )}
                                </List.Item>
                            </List>
                        </WalletGated>
                    </BlockStack>
                </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
                <BlockStack gap="500">
                    <ShopInfo />
                </BlockStack>
            </Layout.Section>
        </>
    );
}
