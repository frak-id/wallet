import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { ExplorerList } from "@/module/explorer/component/ExplorerList";
import { ExplorerSortButton } from "@/module/explorer/component/ExplorerSortButton";

/**
 * Explorer page body (title + merchant list). Shared by the `/explorer` route
 * and the `/explorer/$merchantId` deep-link route so the deep link looks
 * identical to the canonical page during its brief resolve window.
 */
export function ExplorerPage() {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <Inline space="none" align="right">
                <ExplorerSortButton />
            </Inline>
            <Title size="page">{t("explorer.pageTitle")}</Title>
            <ExplorerList />
        </Stack>
    );
}
