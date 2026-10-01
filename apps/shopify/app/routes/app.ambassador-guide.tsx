import { AmbassadorGuide } from "app/components/AmbassadorGuide";
import { PageHeading } from "app/components/ui/PageHeading";
import type { loader as appLoader } from "app/routes/app";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Await, useRouteLoaderData } from "react-router";

export default function AmbassadorGuidePage() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");

    return (
        <s-page heading={t("ambassadorGuide.title")}>
            <PageHeading>{t("ambassadorGuide.title")}</PageHeading>
            <Suspense>
                <Await resolve={rootData?.onboardingDataPromise}>
                    {(onboarding) => (
                        <AmbassadorGuide
                            state={
                                onboarding?.ambassadorPage ?? { state: "none" }
                            }
                            pageTemplates={onboarding?.pageTemplates ?? []}
                            ambassadorTemplates={
                                onboarding?.ambassadorTemplates ?? []
                            }
                        />
                    )}
                </Await>
            </Suspense>
        </s-page>
    );
}
