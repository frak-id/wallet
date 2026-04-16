import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { LogoFrak } from "@frak-labs/design-system/icons";
import { HandleErrors, PairingView, ua } from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthActions } from "@/module/authentication/component/AuthActions";
import * as layout from "@/module/authentication/component/authLayout.css";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import { PageLayout } from "@/module/common/component/PageLayout";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";

export const Route = createFileRoute("/_wallet/_auth/login")({
    component: LoginPage,
});

/**
 * LoginPage
 *
 * Authentication page. Mirrors the SSO layout: centered hero + footer
 * actions on the default view, and the shared PairingView when the user
 * chooses to pair via QR code.
 */
function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [error, setError] = useState<Error | null>(null);
    const [view, setView] = useState<"choose" | "pairing">("choose");
    const { executePendingActions } = useExecutePendingActions();

    const handlePostLoginRedirect = useCallback(async () => {
        const navigated = await executePendingActions();
        if (!navigated) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [executePendingActions, navigate]);

    if (view === "pairing") {
        return (
            <>
                <DemoTapZone navigate={navigate} />
                <PairingInProgress />
                <PageLayout>
                    <Box className={layout.contentTop}>
                        <PairingView
                            title={t("authent.sso.pairing.title")}
                            description={t("authent.sso.pairing.description")}
                            onSuccess={handlePostLoginRedirect}
                        />
                    </Box>
                </PageLayout>
            </>
        );
    }

    return (
        <>
            <DemoTapZone navigate={navigate} />
            <PairingInProgress />
            <PageLayout
                footer={
                    <>
                        {error && (
                            <HandleErrors
                                error={error}
                                className={layout.errorText}
                            />
                        )}
                        <Box className={layout.actions}>
                            <AuthActions
                                onSuccess={handlePostLoginRedirect}
                                onError={setError}
                                loginButtonText="wallet.login.button"
                            />
                            {!ua.isMobile && (
                                <Box>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setView("pairing")}
                                    >
                                        {t("wallet.login.useQRCode")}
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </>
                }
            >
                <Box className={layout.content}>
                    <ContentBlock
                        icon={
                            <Box className={layout.heroIcon}>
                                <LogoFrak width={48} height={48} />
                            </Box>
                        }
                        titleAs="h1"
                        title={t("wallet.login.title")}
                        contentSpacing="l"
                    />
                </Box>
            </PageLayout>
        </>
    );
}
