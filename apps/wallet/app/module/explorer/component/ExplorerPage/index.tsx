import { Box } from "@frak-labs/design-system/components/Box";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { ExplorerList } from "@/module/explorer/component/ExplorerList";

/**
 * Explorer page body (title + merchant list). Shared by the `/explorer` route
 * and the `/explorer/$merchantId` deep-link route so the deep link looks
 * identical to the canonical page during its brief resolve window.
 */
export function ExplorerPage() {
    const { t } = useTranslation();
    return (
        <Box display="flex" flexDirection="column" gap="m">
            <Title size="page">{t("explorer.pageTitle")}</Title>
            <ExplorerList />
        </Box>
    );
}
