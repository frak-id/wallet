import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { createFileRoute } from "@tanstack/react-router";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { Title } from "@/module/common/component/Title";
import { MoneriumStatus } from "@/module/monerium/component/MoneriumStatus";
import { Balance } from "@/module/tokens/component/Balance";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { EarningsSection } from "@/module/wallet/component/EarningsSection";
import { WelcomeCard } from "@/module/wallet/component/WelcomeCard";

export const Route = createFileRoute("/_wallet/_protected/wallet/")({
    component: WalletPage,
});

/**
 * HydratedComponents — renders after hydration only
 */
const HydratedComponents = memo(function HydratedComponents() {
    return <>{!isRunningInProd && <MoneriumStatus />}</>;
});

function WalletPage() {
    const { t } = useTranslation();
    const isHydrated = useHydrated();

    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Title size="page">{t("wallet.pageTitle")}</Title>
            <DemoAccount />
            <Balance />
            <WelcomeCard />
            <EarningsSection />
            {isHydrated && <HydratedComponents />}
        </Box>
    );
}
