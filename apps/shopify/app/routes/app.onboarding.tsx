import { Stepper } from "app/components/Stepper";
import { PageHeading } from "app/components/ui/PageHeading";
import { clearMerchantCache } from "app/services.server/merchant";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    switch (intent) {
        case "clearCache": {
            await clearMerchantCache(context);
            return { success: true };
        }
        default: {
            return { success: false, error: "Invalid intent" };
        }
    }
}

export default function OnBoardingPage() {
    const { t } = useTranslation();

    return (
        <s-page heading={t("common.title")}>
            <PageHeading>{t("common.title")}</PageHeading>
            <Stepper redirectToApp={true} />
        </s-page>
    );
}
