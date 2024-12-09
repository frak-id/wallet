import { useLoaderData } from "@remix-run/react";
import { BlockStack, Card, InlineStack, Link, Text } from "@shopify/polaris";
import type { loader } from "app/routes/app._index";
import { productIdFromDomain } from "app/utils/productIdFromDomain";
import { useMemo } from "react";

// todo: Info to fetch: is product minted, number of active campaigns, shopify webhook + oracle setup status

/**
 * Some basic information about the shop
 * @constructor
 */
export function ShopInfo() {
    const {
        shop: { name, myshopifyDomain },
    } = useLoaderData<typeof loader>();

    const someInfos = useMemo(() => {
        // Get some info
        const productId = productIdFromDomain(myshopifyDomain);
        return {
            productId,
            shop: myshopifyDomain,
            dashboardLink: `${process.env.BUSINESS_URL}/product/${productId}`,
        };
    }, [myshopifyDomain]);

    return (
        <Card>
            <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                    Product information's
                </Text>
                <BlockStack gap="200">
                    <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                            Name:
                        </Text>
                        <span>{name}</span>
                    </InlineStack>

                    <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                            Domain:
                        </Text>
                        <span>{myshopifyDomain}</span>
                    </InlineStack>

                    <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                            Frak Dashboard:
                        </Text>
                        <Link
                            url={
                                someInfos?.dashboardLink ??
                                process.env.BUSINESS_URL
                            }
                            target="_blank"
                            removeUnderline
                        >
                            See on dashboard
                        </Link>
                    </InlineStack>
                </BlockStack>
            </BlockStack>
        </Card>
    );
}
