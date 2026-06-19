import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { RouteError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantDetails } from "@/module/merchant/component/MerchantDetails";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/m/$merchantId/merchant/")({
    staticData: { shell: "bare" },
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantPage,
    errorComponent: MerchantPageError,
});

function MerchantPageError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.merchantNotFound.title")}
            message={t("errors.merchantNotFound.message")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.merchantNotFound.back")}
            showRetry={false}
        />
    );
}

function MerchantPage() {
    const { merchantId } = Route.useParams();
    return <MerchantDetails merchantId={merchantId} />;
}
