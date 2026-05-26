import { Box } from "@frak-labs/design-system/components/Box";
import { PullToRefresh } from "@frak-labs/design-system/components/PullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppShellScroll } from "@/module/common/component/AppShell";
import { Title } from "@/module/common/component/Title";
import { Balance } from "@/module/tokens/component/Balance";
import { AddEmailCard } from "@/module/wallet/component/AddEmailCard";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { EarningsSection } from "@/module/wallet/component/EarningsSection";
import { WelcomeCard } from "@/module/wallet/component/WelcomeCard";

export const Route = createFileRoute("/_wallet/_protected/wallet/")({
    component: WalletPage,
});

function WalletPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const scrollRef = useAppShellScroll();

    const handleRefresh = useCallback(async () => {
        // Only refetch queries currently mounted on this page (balance,
        // earnings, etc.) instead of invalidating the entire cache, which
        // would also refetch unrelated screens (settings, history, …).
        await queryClient.refetchQueries({ type: "active" });
    }, [queryClient]);

    return (
        <PullToRefresh scrollContainerRef={scrollRef} onRefresh={handleRefresh}>
            <Box display="flex" flexDirection="column" gap="m">
                <Title size="page">{t("wallet.pageTitle")}</Title>
                <DemoAccount />
                <Balance />
                <AddEmailCard />
                <WelcomeCard />
                <EarningsSection />
            </Box>
        </PullToRefresh>
    );
}
