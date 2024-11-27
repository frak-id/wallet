import type { LoaderFunctionArgs } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
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
import { shopInfo } from "app/services.server/shop";
import { useCallback, useMemo } from "react";
import { ShopInfo } from "../components/ShopInfo";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const shop = await shopInfo(context);
    return { shop };
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
    const goToDashboard = useCallback(() => {
        // Open a new window in business.frak.id
        window.open(process.env.BUSINESS_URL, "_blank");
    }, []);

    return (
        <Page
            title="Frak configuration"
            primaryAction={
                <Button variant="primary" onClick={goToDashboard}>
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
    const shopify = useAppBridge();
    const frakModalConfigurationLink = useMemo(() => {
        if (typeof window === "undefined") {
            return "";
        }

        return `https://${shopify.config.shop}/admin/themes/current/editor?context=apps&activateAppId={uuid}/listener`;
    }, [shopify]);

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
                                        url={frakModalConfigurationLink}
                                        target="_blank"
                                    >
                                        Setup Frak embeded app within your theme
                                    </Link>
                                </List.Item>
                                <List.Item>
                                    Add the sharing button where you want
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
