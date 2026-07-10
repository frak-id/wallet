import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { ScrollEdgeBlur } from "@/module/common/component/ScrollEdgeBlur";
import { ExplorerList } from "@/module/explorer/component/ExplorerList";
import { ExplorerSortButton } from "@/module/explorer/component/ExplorerSortButton";
import { useScrollMorphTitle } from "@/module/explorer/hook/useScrollMorphTitle";
import * as styles from "./index.css";

/**
 * Explorer page body (title + merchant list). Shared by the `/explorer` route
 * and the `/explorer/$merchantId` deep-link route so the deep link looks
 * identical to the canonical page during its brief resolve window.
 */
export function ExplorerPage() {
    const { t } = useTranslation();
    const { titleRef } = useScrollMorphTitle();
    const pageTitle = t("explorer.pageTitle");

    return (
        <Stack space="m">
            <div className={styles.stickyHeader}>
                <ScrollEdgeBlur className={styles.scrollBlur} />
                {/* Pinned in the toolbar band; the hook shrinks it in place. */}
                <h1 ref={titleRef} className={styles.title}>
                    <span className={styles.titleText}>{pageTitle}</span>
                </h1>
                <Inline space="none" align="right">
                    <ExplorerSortButton />
                </Inline>
            </div>
            <ExplorerList />
        </Stack>
    );
}
