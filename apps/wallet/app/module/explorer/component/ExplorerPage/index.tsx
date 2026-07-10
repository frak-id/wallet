import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { ScrollEdgeBlur } from "@/module/common/component/ScrollEdgeBlur";
import { ExplorerList } from "@/module/explorer/component/ExplorerList";
import { ExplorerSortButton } from "@/module/explorer/component/ExplorerSortButton";
import { useCollapsibleTitle } from "@/module/explorer/hook/useCollapsibleTitle";
import * as styles from "./index.css";

/**
 * Explorer page body (title + merchant list). Shared by the `/explorer` route
 * and the `/explorer/$merchantId` deep-link route so the deep link looks
 * identical to the canonical page during its brief resolve window.
 */
export function ExplorerPage() {
    const { t } = useTranslation();
    const { headerRef, sentinelRef, collapsed } = useCollapsibleTitle();
    const pageTitle = t("explorer.pageTitle");

    return (
        <Stack space="m">
            <div ref={headerRef} className={styles.stickyHeader}>
                <ScrollEdgeBlur className={styles.scrollBlur} />
                <Inline space="none" align="right">
                    <ExplorerSortButton />
                </Inline>
            </div>
            <h1
                className={`${styles.title}${collapsed ? ` ${styles.titleCollapsed}` : ""}`}
            >
                {pageTitle}
            </h1>
            {/* The sticky title pins to the top, so observe a zero-height
                sentinel at the top of the content instead. Once it slides up
                under the toolbar the title has collapsed. A small sentinel is
                required: observing the tall list itself never reports
                "scrolled past", since part of it always stays on screen. It is
                positioned absolutely so it adds no gap to the layout. */}
            <div className={styles.listWrapper}>
                <span
                    ref={sentinelRef}
                    className={styles.collapseSentinel}
                    aria-hidden
                />
                <ExplorerList />
            </div>
        </Stack>
    );
}
