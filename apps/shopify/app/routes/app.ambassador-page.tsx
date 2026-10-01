import {
    type AmbassadorPageActionResult,
    applyAmbassadorTemplate,
    createAndRecordAmbassadorPage,
    keepStandardLayout,
    linkAmbassadorPage,
    normalizeAmbassadorPageLanguage,
    restoreAmbassadorComponent,
} from "app/services.server/ambassadorPage";
import { authenticate } from "app/shopify.server";
import type { AuthenticatedContext } from "app/types/context";
import type { ActionFunctionArgs } from "react-router";

// Action-only route: useAmbassadorPageAction fetcher-submits here.
export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = String(formData.get("intent"));
    return { ...(await runIntent(context, formData, intent)), intent };
}

function runIntent(
    context: AuthenticatedContext,
    formData: FormData,
    intent: string
): Promise<AmbassadorPageActionResult> | AmbassadorPageActionResult {
    if (intent === "link") {
        return linkAmbassadorPage(context);
    }
    if (intent === "apply") {
        const template = formData.get("template");
        return applyAmbassadorTemplate(
            context,
            typeof template === "string" ? template : ""
        );
    }
    if (intent === "restore") {
        return restoreAmbassadorComponent(context);
    }
    if (intent === "keepStandard") {
        return keepStandardLayout(context);
    }
    if (intent === "create") {
        return createAndRecordAmbassadorPage(
            context,
            normalizeAmbassadorPageLanguage(formData.get("language"))
        );
    }
    return { ok: false, reason: "createFailed" };
}
