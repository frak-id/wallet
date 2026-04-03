import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { CodeDisplay } from "@/module/recovery-code/component/CodeDisplay";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";

type InstallSearch = {
    m?: string;
    a?: string;
};

const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";
const playStoreUrl =
    "https://play.google.com/store/apps/details?id=id.frak.wallet";

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

    const { data, isLoading, error } = useGenerateInstallCode({
        merchantId,
        anonymousId,
    });

    // Platform-aware store URL
    const downloadUrl = useMemo(() => {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (!isAndroid) return appStoreUrl;
        if (!merchantId || !anonymousId) return playStoreUrl;
        const referrerData = `merchantId=${merchantId}&anonymousId=${anonymousId}`;
        return `${playStoreUrl}&referrer=${encodeURIComponent(referrerData)}`;
    }, [merchantId, anonymousId]);

    return (
        <PageLayout
            footer={
                <Box
                    as="a"
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    display={"flex"}
                    alignItems={"center"}
                    justifyContent={"center"}
                    padding={"m"}
                    borderRadius={"full"}
                    backgroundColor={"primary"}
                    color={"onAction"}
                    fontWeight={"semiBold"}
                    fontSize={"m"}
                >
                    {t("installCode.download")}
                </Box>
            }
        >
            <Stack space={"l"} align={"center"}>
                <Stack space={"m"} align={"center"}>
                    <Title size="page">{t("installCode.title")}</Title>
                    <Text variant="body" color="secondary" align="center">
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

                <Card variant={"muted"} padding={"compact"}>
                    <Inline space={"s"} alignY={"center"}>
                        <Info size={18} />
                        <Stack space={"xxs"}>
                            <Text variant="bodySmall" weight="semiBold">
                                {t("installCode.infoTitle")}
                            </Text>
                            <Text variant="caption" color="secondary">
                                {t("installCode.infoDescription")}
                            </Text>
                        </Stack>
                    </Inline>
                </Card>
            </Stack>
        </PageLayout>
    );
}
