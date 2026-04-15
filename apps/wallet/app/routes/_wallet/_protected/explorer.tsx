import { Box } from "@frak-labs/design-system/components/Box";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { ExplorerList } from "@/module/explorer/component/ExplorerList";

export const Route = createFileRoute("/_wallet/_protected/explorer")({
    component: ExplorerPage,
});

function ExplorerPage() {
    const { t } = useTranslation();
    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Title size="page">{t("explorer.pageTitle")}</Title>
            <ExplorerList />
        </Box>
    );
}
