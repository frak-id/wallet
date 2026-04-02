import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./install.css";

type InstallSearch = {
    m?: string;
    a?: string;
};

const localStorageKey = "frak_install_context";
const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";

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
    const [code, setCode] = useState<string>();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();

    // Store context in localStorage for ASWebAuthenticationSession
    useEffect(() => {
        if (!merchantId || !anonymousId) return;
        localStorage.setItem(
            localStorageKey,
            JSON.stringify({ merchantId, anonymousId })
        );
    }, [merchantId, anonymousId]);

    // Generate install code on mount
    useEffect(() => {
        if (!merchantId || !anonymousId) return;

        let cancelled = false;
        setIsLoading(true);

        authenticatedBackendApi.user.identity["install-code"].generate
            .post({ merchantId, anonymousId })
            .then(({ data, error: apiError }) => {
                if (cancelled) return;
                if (apiError || !data) {
                    setError(t("installCode.error"));
                    return;
                }
                setCode(data.code);
            })
            .catch(() => {
                if (!cancelled) setError(t("installCode.error"));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [merchantId, anonymousId, t]);

    const playStoreUrl = useMemo(() => {
        if (!merchantId || !anonymousId) return undefined;
        const referrerData = `merchantId=${merchantId}&anonymousId=${anonymousId}`;
        return `https://play.google.com/store/apps/details?id=id.frak.wallet&referrer=${encodeURIComponent(referrerData)}`;
    }, [merchantId, anonymousId]);

    return (
        <PageLayout
            footer={
                <div className={styles.storeLinks}>
                    <Box
                        as="a"
                        href={appStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.storeLink}
                    >
                        {t("installCode.appStore")}
                    </Box>
                    {playStoreUrl && (
                        <Box
                            as="a"
                            href={playStoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.storeLinkSecondary}
                        >
                            {t("installCode.playStore")}
                        </Box>
                    )}
                </div>
            }
        >
            <div className={styles.wrapper}>
                <Box display={"flex"} flexDirection={"column"} gap={"m"}>
                    <Title size="page">{t("installCode.title")}</Title>
                    <p className={styles.description}>
                        {t("installCode.description")}
                    </p>
                </Box>

                {isLoading && (
                    <Box
                        display={"flex"}
                        flexDirection={"column"}
                        alignItems={"center"}
                        gap={"m"}
                    >
                        <Spinner />
                        <Text variant="bodySmall" color="secondary">
                            {t("installCode.loading")}
                        </Text>
                    </Box>
                )}

                {error && <p className={styles.errorText}>{error}</p>}

                {code && (
                    <div className={styles.codeSection}>
                        <span className={styles.codeLabel}>
                            {t("installCode.codeTitle")}
                        </span>
                        <div className={styles.codeDisplay}>
                            {code.split("").map((char, index) => (
                                <span key={index} className={styles.codeChar}>
                                    {char}
                                </span>
                            ))}
                        </div>
                        <p className={styles.codeHint}>
                            {t("installCode.codeDescription")}
                        </p>
                    </div>
                )}

                {merchantId && anonymousId && (
                    <div className={styles.savedBanner}>
                        <strong>{t("installCode.contextSaved")}</strong>
                        <p>{t("installCode.contextSavedDescription")}</p>
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
