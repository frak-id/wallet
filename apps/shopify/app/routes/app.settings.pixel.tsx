import type { IntentWebPixel } from "app/components/Pixel";
import { log } from "app/services.server/logger";
import {
    createWebPixel,
    deleteWebPixel,
    getWebPixel,
} from "app/services.server/webPixel";
import { authenticate } from "app/shopify.server";
import type { ActionFunctionArgs } from "react-router";

// Action-only route: the settings page (app.settings.tsx) renders the pixel
// UI directly, but app/components/Pixel/index.tsx fetcher-submits here.
export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as IntentWebPixel;

    // Fail open: degrade to a surfaced userError instead of bouncing the whole
    // settings page to a full-page error (consistent with app.appearance.tsx).
    try {
        switch (intent) {
            case "createWebPixel": {
                return await createWebPixel(context);
            }

            case "deleteWebPixel": {
                const webPixel = await getWebPixel(context);
                return await deleteWebPixel({ ...context, id: webPixel.id });
            }
        }
    } catch (error) {
        log.error({ err: error, intent }, "web pixel action failed");
        return {
            userErrors: [
                { message: "Something went wrong. Please try again." },
            ],
        };
    }
}
