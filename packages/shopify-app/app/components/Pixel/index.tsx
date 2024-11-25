import { useFetcher } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Button } from "@shopify/polaris";
import type {
    CreateWebPixelReturnType,
    DeleteWebPixelReturnType,
} from "app/services.server/webPixel";
import { useEffect, useState } from "react";

export function Pixel({ id }: { id?: string }) {
    const shopify = useAppBridge();
    const fetcher = useFetcher<
        CreateWebPixelReturnType | DeleteWebPixelReturnType
    >();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!fetcher.data) return;

        const data = fetcher.data;
        const { userErrors } = data;
        const webPixel = (data as CreateWebPixelReturnType).webPixel;
        const deletedWebPixelId = (data as DeleteWebPixelReturnType)
            .deletedWebPixelId;

        if (userErrors?.length > 0) {
            shopify.toast.show("Application pixel deletion error.", {
                isError: true,
            });
        }

        if (webPixel) {
            shopify.toast.show("Application pixel connected successfully");
        }

        if (deletedWebPixelId) {
            shopify.toast.show("Application pixel disconnected successfully");
        }

        setLoading(false);
    }, [fetcher.data, shopify.toast]);

    const handleAction = async (
        intent: "createWebPixel" | "deleteWebPixel"
    ) => {
        setLoading(true);
        fetcher.submit({ intent }, { method: "POST" });
    };

    return (
        <>
            {!id && (
                <Button
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    onClick={() => handleAction("createWebPixel")}
                >
                    Connect application pixel
                </Button>
            )}
            {id && (
                <Button
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    onClick={() => handleAction("deleteWebPixel")}
                >
                    Disconnect application pixel
                </Button>
            )}
        </>
    );
}
