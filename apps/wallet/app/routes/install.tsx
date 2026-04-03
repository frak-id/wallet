import { Card } from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { AppStoreLinks } from "@/module/recovery-code/component/AppStoreLinks";
import { CodeDisplay } from "@/module/recovery-code/component/CodeDisplay";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";

type InstallSearch = {
    m?: string;
    a?: string;
};

const localStorageKey = "frak_install_context";

export const Route = createFileRoute("/install")({
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
    }),
    component: InstallPage,
});

function InstallPage() {
    const { t } = useTranslation();
    const { m: merchantId, a: anonymousId } = Route.useSearch();

    // Store context in localStorage for ASWebAuthenticationSession
    useEffect(() => {
        if (!merchantId || !anonymousId) return;
        localStorage.setItem(
            localStorageKey,
            JSON.stringify({ merchantId, anonymousId })
        );
    }, [merchantId, anonymousId]);

    const { data, isLoading, error } = useGenerateInstallCode({
        merchantId,
        anonymousId,
    });

    return (
        <PageLayout
            footer={
                <AppStoreLinks
                    merchantId={merchantId}
                    anonymousId={anonymousId}
                />
            }
        >
            <Stack space={"l"} align={"center"}>
                <Stack space={"m"}>
                    <Title size="page">{t("installCode.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("installCode.description")}
                    </Text>
                </Stack>

                {isLoading && (
                    <Stack space={"m"} align={"center"}>
                        <Spinner />
                        <Text variant="bodySmall" color="secondary">
                            {t("installCode.loading")}
                        </Text>
                    </Stack>
                )}

                {error && (
                    <Text variant="bodySmall" color="error">
                        {t("installCode.error")}
                    </Text>
                )}

                {data?.code && <CodeDisplay code={data.code} />}
            </Stack>
        </PageLayout>
    );
}
