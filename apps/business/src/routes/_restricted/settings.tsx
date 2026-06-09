import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/module/common/component/PageShell";
import { CurrencyCard } from "@/module/settings/CurrencyCard";
import { DemoModeCard } from "@/module/settings/DemoModeCard";
import { LanguageCard } from "@/module/settings/LanguageCard";
import { WalletAddressCard } from "@/module/settings/WalletAddressCard";
import { content, tabContent } from "./settings.css";

export const Route = createFileRoute("/_restricted/settings")({
    component: Settings,
});

function Settings() {
    const { t } = useTranslation();

    return (
        <PageShell page="settings" space="l">
            <Tabs defaultValue="usage" className={content}>
                <TabsList variant="navigation">
                    <TabsTrigger variant="navigation" value="usage">
                        {t("settings.tabs.usage")}
                    </TabsTrigger>
                    <TabsTrigger variant="navigation" value="billing" disabled>
                        {t("settings.tabs.billing")}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="usage" className={tabContent}>
                    <Stack space="l">
                        <WalletAddressCard />
                        <CurrencyCard />
                        <LanguageCard />
                        <DemoModeCard />
                    </Stack>
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}
