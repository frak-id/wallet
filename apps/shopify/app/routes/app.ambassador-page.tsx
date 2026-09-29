import {
    type AmbassadorPageActionResult,
    createAndRecordAmbassadorPage,
    linkAmbassadorPage,
    normalizeAmbassadorPageLanguage,
} from "app/services.server/ambassadorPage";
import { authenticate } from "app/shopify.server";
import type { ActionFunctionArgs } from "react-router";

// Action-only route: app/components/OptionalSetup fetcher-submits here.
export async function action({
    request,
}: ActionFunctionArgs): Promise<AmbassadorPageActionResult> {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "link") {
        return linkAmbassadorPage(context);
    }
    if (intent === "create") {
        return createAndRecordAmbassadorPage(
            context,
            normalizeAmbassadorPageLanguage(formData.get("language"))
        );
    }
    return { ok: false, reason: "createFailed" };
}
