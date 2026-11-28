import { log } from "app/services.server/logger";
import {
    connectSubscriptionProvider,
    disconnectSubscriptionProvider,
} from "app/services.server/subscriptions";
import { authenticate } from "app/shopify.server";
import { isTokenSubmittable } from "app/utils/subscriptions";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";

// Action-only route: app/components/Subscriptions fetcher-submits here. The
// token is relayed to the backend and never stored or logged on this side.
export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    switch (intent) {
        case "connectSubscription": {
            const token = formData.get("token");
            if (typeof token !== "string" || !isTokenSubmittable(token)) {
                return { intent, result: "invalid_token" as const };
            }
            const result = await connectSubscriptionProvider(context, request, {
                provider: "recharge",
                token: token.trim(),
            });
            return { intent, result };
        }

        case "disconnectSubscription": {
            const success = await disconnectSubscriptionProvider(
                context,
                request
            );
            return { intent, success };
        }

        default:
            log.warn({ intent }, "subscriptions action: unknown intent");
            return data(null, { status: 400 });
    }
}
