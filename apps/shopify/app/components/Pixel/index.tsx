import { useRefreshData } from "app/hooks/useRefreshData";
import type {
    CreateWebPixelReturnType,
    DeleteWebPixelReturnType,
} from "app/services.server/webPixel";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

export type IntentWebPixel = "createWebPixel" | "deleteWebPixel";

export function Pixel({ id }: { id?: string }) {
    const fetcher = useFetcher<
        CreateWebPixelReturnType | DeleteWebPixelReturnType
    >();
    const { t } = useTranslation();
    const refresh = useRefreshData();

    useEffect(() => {
        if (!fetcher.data) return;

        const data = fetcher.data;
        const { userErrors } = data;
        const webPixel = (data as CreateWebPixelReturnType).webPixel;
        const deletedWebPixelId = (data as DeleteWebPixelReturnType)
            .deletedWebPixelId;

        if (userErrors?.length > 0) {
            window.shopify?.toast.show(t("pixel.actions.messages.error"), {
                isError: true,
            });
        }

        if (webPixel) {
            window.shopify?.toast.show(t("pixel.actions.messages.connect"));
            refresh();
        }

        if (deletedWebPixelId) {
            window.shopify?.toast.show(t("pixel.actions.messages.disconnect"));
            refresh();
        }
    }, [fetcher.data, t, refresh]);

    const handleAction = async (intent: IntentWebPixel) => {
        fetcher.submit(
            { intent },
            { method: "POST", action: "/app/settings/pixel" }
        );
    };

    return (
        <>
            {!id && (
                <s-button
                    variant="primary"
                    loading={fetcher.state !== "idle"}
                    disabled={fetcher.state !== "idle"}
                    onClick={() => handleAction("createWebPixel")}
                >
                    {t("pixel.actions.cta.connect")}
                </s-button>
            )}
            {id && (
                <s-button
                    variant="primary"
                    loading={fetcher.state !== "idle"}
                    disabled={fetcher.state !== "idle"}
                    onClick={() => handleAction("deleteWebPixel")}
                >
                    {t("pixel.actions.cta.disconnect")}
                </s-button>
            )}
        </>
    );
}
