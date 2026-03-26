import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { MoneriumStatus } from "@/module/monerium/component/MoneriumStatus";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { EarningsSection } from "@/module/wallet/component/EarningsSection";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";
import { WelcomeCard } from "@/module/wallet/component/WelcomeCard";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: WalletPage,
});

/**
 * HydratedComponents — renders after hydration only
 */
const HydratedComponents = memo(function HydratedComponents() {
    return (
        <>
            <EnableNotification />
            <PendingReferral />
            {!isRunningInProd && <MoneriumStatus />}
        </>
    );
});

function WalletPage() {
    const { t } = useTranslation();
    const isHydrated = useHydrated();

    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Text as="h1">{t("wallet.pageTitle")}</Text>
            <DemoAccount />
            <Balance />
            <WelcomeCard />
            <EarningsSection />
            {isHydrated && <HydratedComponents />}
        </Box>
    );
}
