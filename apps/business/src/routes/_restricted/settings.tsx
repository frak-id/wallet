import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { PageShell } from "@/module/common/component/PageShell";
import { useLogout } from "@/module/common/hook/useLogout";
import { DemoModeSwitch } from "@/module/settings/DemoModeSwitch";
import { LanguageSelector } from "@/module/settings/LanguageSelector";
import { SelectCurrency } from "@/module/settings/SelectCurrency";
import { logoutButton, walletAddress } from "./settings.css";

export const Route = createFileRoute("/_restricted/settings")({
    component: Settings,
});

function Settings() {
    const { t } = useTranslation();
    const { data: walletStatus } = useWalletStatus();
    const { isDemoMode } = useDemoMode();
    const logout = useLogout();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    const showDemoCopy = isHydrated && isDemoMode;

    return (
        <PageShell page="settings">
            <Stack space="l">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("settings.wallet.title")}</CardTitle>
                    </CardHeader>
                    <p className={walletAddress}>
                        {t("settings.wallet.address", {
                            wallet: walletStatus?.wallet ?? "",
                        })}
                    </p>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("settings.currency.title")}</CardTitle>
                    </CardHeader>
                    <SelectCurrency />
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("settings.language.title")}</CardTitle>
                    </CardHeader>
                    <LanguageSelector />
                </Card>

                {isHydrated && !isDemoMode && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("settings.demo.title")}</CardTitle>
                        </CardHeader>
                        <DemoModeSwitch />
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>{t("settings.logout.title")}</CardTitle>
                    </CardHeader>
                    <p>
                        {showDemoCopy
                            ? t("settings.logout.description_demo")
                            : t("settings.logout.description")}
                    </p>
                    <Button
                        variant={"primary"}
                        className={logoutButton}
                        onClick={logout}
                    >
                        {showDemoCopy
                            ? t("settings.logout.action_demo")
                            : t("settings.logout.action")}
                    </Button>
                </Card>
            </Stack>
        </PageShell>
    );
}
