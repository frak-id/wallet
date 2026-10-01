import {
    AmbassadorGuide,
    VintageAmbassadorGuide,
} from "app/components/AmbassadorGuide";
import { PageHeading } from "app/components/ui/PageHeading";
import type { loader as appLoader } from "app/routes/app";
import { type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Await, useRouteLoaderData } from "react-router";

export default function AmbassadorGuidePage() {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");

    return (
        <Suspense>
            <Await resolve={rootData?.isThemeSupportedPromise}>
                {(isThemeSupported) =>
                    (isThemeSupported ?? true) ? (
                        <GuidePage titleKey="ambassadorGuide.title">
                            <Await resolve={rootData?.onboardingDataPromise}>
                                {(onboarding) => (
                                    <AmbassadorGuide
                                        state={
                                            onboarding?.ambassadorPage ?? {
                                                state: "none",
                                            }
                                        }
                                        pageTemplates={
                                            onboarding?.pageTemplates ?? []
                                        }
                                        ambassadorTemplates={
                                            onboarding?.ambassadorTemplates ??
                                            []
                                        }
                                    />
                                )}
                            </Await>
                        </GuidePage>
                    ) : (
                        <GuidePage titleKey="ambassadorGuide.vintage.title">
                            <VintageAmbassadorGuide />
                        </GuidePage>
                    )
                }
            </Await>
        </Suspense>
    );
}

function GuidePage({
    titleKey,
    children,
}: {
    titleKey: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <s-page heading={t(titleKey)}>
            <PageHeading>{t(titleKey)}</PageHeading>
            {children}
        </s-page>
    );
}
