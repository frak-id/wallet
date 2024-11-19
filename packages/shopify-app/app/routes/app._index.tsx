import type { LoaderFunctionArgs } from "@remix-run/node";
import { TitleBar } from "@shopify/app-bridge-react";
import { BlockStack, Card, Layout, Page, Text } from "@shopify/polaris";
import { useCallback } from "react";
import { ShopInfo } from "../components/ShopInfo";
import { WalletGated } from "../components/WalletGated";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);
    const admin = await authenticate.admin(request);
    admin.admin.graphql;
    return null;
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
    const goToDashboard = useCallback(() => {
        // Open a new window in business.frak.id
        window.open("https://business.frak.id", "_blank");
    }, []);

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

                                    <Text as="p" variant="bodyMd">
                                        Here you can do: - Manage your product -
                                        Auto setup pixel? - Auto setup the
                                        webhook? - Auto push the assets for the
                                        frak sdk?
                                    </Text>
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
