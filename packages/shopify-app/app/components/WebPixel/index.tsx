import { useFetcher } from "@remix-run/react";
import {
    Banner,
    BlockStack,
    Button,
    Card,
    InlineError,
    Text,
} from "@shopify/polaris";
import type { WebPixelReturnType } from "app/services.server/webPixel";
import { useEffect, useState } from "react";

export function WebPixel() {
    const fetcher = useFetcher<WebPixelReturnType>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<WebPixelReturnType["userErrors"] | null>(
        null
    );
    const [successData, setSuccessData] = useState(false);

    useEffect(() => {
        if (!fetcher.data) return;

        const { userErrors, webPixel } = fetcher.data;

        if (userErrors?.length > 0) {
            setError(userErrors);
        }

        if (webPixel) {
            setSuccessData(true);
        }

        setLoading(false);
    }, [fetcher.data]);

    const handleActivation = async () => {
        setLoading(true);
        setError(null);
        setSuccessData(false);
        fetcher.submit({}, { method: "POST" });
    };

    return (
        <Card>
            <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                    Frak application pixel
                </Text>
                <div>
                    <Button
                        variant="primary"
                        loading={loading}
                        disabled={loading}
                        onClick={handleActivation}
                    >
                        Activate Web Pixel
                    </Button>

                    {error && (
                        <Banner title="Activation Error">
                            {error.map((err) => (
                                <InlineError
                                    key={`index-${err.message}`}
                                    fieldID={err.field}
                                    message={
                                        err.field
                                            ? `${err.field}: ${err.message}`
                                            : err.message
                                    }
                                />
                            ))}
                        </Banner>
                    )}

                    {successData && (
                        <Banner title="Pixel Activated">
                            Pixel activated successfully.
                        </Banner>
                    )}
                </div>
            </BlockStack>
        </Card>
    );
}
