import { Box } from "@frak-labs/design-system/components/Box";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { Balance } from "@/module/tokens/component/Balance";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { EarningsSection } from "@/module/wallet/component/EarningsSection";
import { WelcomeCard } from "@/module/wallet/component/WelcomeCard";

export const Route = createFileRoute("/_wallet/_protected/wallet/")({
    component: WalletPage,
});

function WalletPage() {
    const { t } = useTranslation();

    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Title size="page">{t("wallet.pageTitle")}</Title>
            <DemoAccount />
            <Balance />
            <WelcomeCard />
            <EarningsSection />
        </Box>
    );
}
