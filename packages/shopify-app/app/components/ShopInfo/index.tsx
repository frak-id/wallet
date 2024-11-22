import { useLoaderData } from "@remix-run/react";
import { BlockStack, Card, InlineStack, Link, Text } from "@shopify/polaris";
import type { loader } from "app/routes/app._index";
import { useMemo } from "react";
import { keccak256, toHex } from "viem";

// todo: Info to fetch: is product minted, number of active campaigns, shopify webhook + oracle setup status

/**
 * Some basic information about the shop
 * @constructor
 */
export function ShopInfo() {
    const { shop } = useLoaderData<typeof loader>();
    const someInfos = useMemo(() => {
        // Get some info
        const productId = keccak256(toHex(shop));
        return {
            productId: keccak256(toHex(shop)),
            shop: shop,
            dashboardLink: `https://business.frak.id/product/${productId}`,
        };
    }, [shop]);

    return (
        <Card>
            <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                    Product information's
                </Text>
                <BlockStack gap="200">
                    <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                            Domain:
                        </Text>
                        <span>{shop}</span>
                    </InlineStack>

                    <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                            Frak Dashboard:
                        </Text>
                        <Link
                            url={
                                someInfos?.dashboardLink ??
                                "https://business.frak.id/"
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
