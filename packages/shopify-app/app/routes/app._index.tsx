import type { LoaderFunctionArgs } from "@remix-run/node";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
    BlockStack,
    Card,
    Layout,
    Link,
    List,
    Page,
    Text,
} from "@shopify/polaris";
import { WalletGated } from "app/components/WalletGated";
import { useCallback, useMemo } from "react";
import { ShopInfo } from "../components/ShopInfo";
import { doesThemeSupportBlock } from "../services.server/theme";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const isThemeSupported = await doesThemeSupportBlock(context);
    return Response.json({ isThemeSupported, shop: context.session.shop });
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
 *   - List webhooks: https://shopify.dev/docs/api/admin-graphql/2024-07/queries/webhookSubscriptions
 *   - Webhook creation? Not sure: https://shopify.dev/docs/api/admin-graphql/2024-07/mutations/webhookSubscriptionCreate
 *   - web pixel extension for post checkout? https://shopify.dev/docs/apps/build/marketing-analytics/build-web-pixels
 *   - theme app extensions for the frak-setup js asset? https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
 * @param request
 */
export default function Index() {
    const shopify = useAppBridge();
    const goToDashboard = useCallback(() => {
        // Open a new window in business.frak.id
        window.open("https://business.frak.id", "_blank");
    }, []);

    const frakModalConfigurationLink = useMemo(() => {
        if (typeof window === "undefined") {
            return "";
        }

        return `https://${shopify.config.shop}/admin/themes/current/editor?context=apps&activateAppId={uuid}/listener`;
    }, [shopify]);

    return (
        <Page>
            <TitleBar title="Frak configuration">
                <button
                    variant="primary"
                    onClick={goToDashboard}
                    type={"button"}
                >
                    Go to dashboard
                </button>
            </TitleBar>
            <BlockStack gap="500">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <BlockStack gap="500">
                                <WalletGated>
                                    <Text as="p" variant="bodyMd">
                                        Ready to manage your product
                                    </Text>

                                    <List type="number">
                                        <List.Item>
                                            Setup Frak application pixel
                                        </List.Item>
                                        <List.Item>
                                            Enable Frak webhook for purchase
                                            tracking
                                        </List.Item>
                                        <List.Item>
                                            Setup Frak embeded app within your
                                            theme
                                        </List.Item>
                                        <List.Item>
                                            Add the sharing button where you
                                            want
                                        </List.Item>
                                    </List>

                                    <Link
                                        url={frakModalConfigurationLink}
                                        target="_blank"
                                    >
                                        Setup frak modal
                                    </Link>
                                </WalletGated>
                            </BlockStack>
                        </Card>
                    </Layout.Section>

                    <Layout.Section variant="oneThird">
                        <BlockStack gap="500">
                            <ShopInfo />
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
}
