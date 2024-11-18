import { useAppBridge } from "@shopify/app-bridge-react";
import { BlockStack, Card, InlineStack, Link, Text } from "@shopify/polaris";
import { useMemo } from "react";
import { keccak256, toHex } from "viem";

// todo: Loader fetch the shop info on the server side
// todo: Info to fetch: is product minted, number of active campaigns, shopify webhook + oracle setup status

/**
 * Some basic information about the shop
 * @constructor
 */
export function ShopInfo() {
    const shopify = useAppBridge();
    const someInfos = useMemo(() => {
        // If on server, early return
        if (typeof window === "undefined") return undefined;

        // Get some info
        const productId = keccak256(toHex(shopify.config.shop ?? ""));
        return {
            productId: keccak256(toHex(shopify.config.shop ?? "")),
            shop: shopify.config.shop,
            dashboardLink: `https://business.frak.id/product/${productId}`,
        };
    }, [shopify]);

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
                        <span>{someInfos?.shop}</span>
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
