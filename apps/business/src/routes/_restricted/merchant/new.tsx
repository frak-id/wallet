import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RouteError } from "@/module/common/component/RouteError";
import { MerchantWizard } from "@/module/dashboard/component/MerchantWizard";

export const Route = createFileRoute("/_restricted/merchant/new")({
    staticData: { shell: "bare" },
    component: MerchantNewPage,
    errorComponent: MerchantNewError,
});

function MerchantNewError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.merchantCreate.title")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.merchantCreate.back")}
        />
    );
}

function MerchantNewPage() {
    return <MerchantWizard />;
}
