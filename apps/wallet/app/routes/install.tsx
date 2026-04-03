import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { getSafeSession } from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { executePendingActions } from "@/module/pending-actions/utils/executePendingActions";
import { CodeDisplay } from "@/module/recovery-code/component/CodeDisplay";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";

type InstallSearch = {
    m?: string;
    a?: string;
};

export const Route = createFileRoute("/install")({
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
    }),
    component: InstallPage,
});

/**
 * Install page — unified entry point for the install/ensure flow.
 *
 * Decision matrix:
 *   Web + not logged in  → Install code + store links (user needs to download the app)
 *   Everything else      → Processing screen (fire ensure or store for post-auth)
 */
function InstallPage() {
    const search = Route.useSearch();

    // Web + not logged in → show install code + store download links
    if (!isTauri() && !getSafeSession()?.token) {
        return <InstallCodeView {...search} />;
    }

    // Tauri (any auth) or web + logged in → processing
    return <InstallProcessing {...search} />;
}

// ---------------------------------------------------------------------------
//  Processing screen — shown on Tauri or when already logged in on web
// ---------------------------------------------------------------------------

const MIN_PROCESSING_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Brief processing screen that handles the ensure call.
 *
 *   Logged in     → store ensure action + drain all pending actions + navigate /wallet
 *   Not logged in → store ensure action for post-auth + navigate /register
 *
 * Always shows for at least MIN_PROCESSING_MS to avoid a flash.
 */
function InstallProcessing({ m: merchantId, a: anonymousId }: InstallSearch) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const hasProcessed = useRef(false);

    useEffect(() => {
        // Guard against StrictMode double-fire
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        async function process() {
            // Build ensure action from install referral params
            const ensureAction =
                merchantId && anonymousId
                    ? ({
                          type: "ensure",
                          merchantId,
                          anonymousId,
                      } as const)
                    : undefined;

            const isLoggedIn = !!getSafeSession()?.token;

            if (isLoggedIn) {
                // Store + drain all pending actions (including the new one)
                const [navigated] = await Promise.all([
                    executePendingActions(navigate, ensureAction),
                    sleep(MIN_PROCESSING_MS),
                ]);
                if (!navigated) {
                    navigate({ to: "/wallet", replace: true });
                }
            } else {
                // Not logged in — store for post-auth, redirect to register
                if (ensureAction) {
                    pendingActionsStore.getState().addAction(ensureAction);
                }
                await sleep(MIN_PROCESSING_MS);
                navigate({ to: "/register", replace: true });
            }
        }

        process();
    }, [merchantId, anonymousId, navigate]);

    return (
        <PageLayout>
            <Stack space={"l"} align={"center"}>
                <Spinner />
                <Text variant="bodySmall" color="secondary">
                    {t("installCode.processing")}
                </Text>
            </Stack>
        </PageLayout>
    );
}

// ---------------------------------------------------------------------------
//  Install code view — web only, when the user needs to download the app
// ---------------------------------------------------------------------------

const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";
const playStoreUrl =
    "https://play.google.com/store/apps/details?id=id.frak.wallet";

function InstallCodeView({ m: merchantId, a: anonymousId }: InstallSearch) {
    const { t } = useTranslation();

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
