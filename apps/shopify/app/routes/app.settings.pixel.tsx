import { type IntentWebPixel, Pixel } from "app/components/Pixel";
import {
    createWebPixel,
    deleteWebPixel,
    getWebPixel,
} from "app/services.server/webPixel";
import { authenticate } from "app/shopify.server";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);

    // If no pixel is found, graphql will throw an error
    try {
        return await getWebPixel(context);
    } catch (error) {
        console.error(error);
        return null;
    }
};

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as IntentWebPixel;

    switch (intent) {
        case "createWebPixel": {
            return createWebPixel(context);
        }

        case "deleteWebPixel": {
            const webPixel = await getWebPixel(context);
            return deleteWebPixel({ ...context, id: webPixel.id });
        }
    }
}

export default function SettingsPixelPage() {
    const webPixel = useLoaderData<typeof loader>();
    const { t } = useTranslation();

    return (
        <s-stack gap="base">
            <s-section>
                <s-stack gap="small">
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        {webPixel && (
                            <s-badge tone="success">
                                {t("pixel.connected")}
                            </s-badge>
                        )}
                        {!webPixel && (
                            <s-badge tone="critical">
                                {t("pixel.notConnected")}
                            </s-badge>
                        )}
                    </s-box>
                    <s-text>{!webPixel && t("pixel.needConnection")}</s-text>
                    <s-text>
                        <Pixel id={webPixel?.id} />
                    </s-text>
                </s-stack>
            </s-section>
        </s-stack>
    );
}
