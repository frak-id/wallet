import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { ScrollEdgeBlur } from "@/module/common/component/ScrollEdgeBlur";
import { Title } from "@/module/common/component/Title";
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
    const { headerRef, titleRef, collapsed } = useCollapsibleTitle();
    const pageTitle = t("explorer.pageTitle");

    return (
        <Stack space="m">
            <div ref={headerRef} className={styles.stickyHeader}>
                <ScrollEdgeBlur className={styles.scrollBlur} />
                <span
                    className={`${styles.smallTitle}${collapsed ? ` ${styles.smallTitleVisible}` : ""}`}
                    aria-hidden="true"
                >
                    <Text
                        as="span"
                        variant="body"
                        weight="semiBold"
                        color="primary"
                        className={styles.smallTitleText}
                    >
                        {pageTitle}
                    </Text>
                </span>
                <Inline space="none" align="right">
                    <ExplorerSortButton />
                </Inline>
            </div>
            <div ref={titleRef}>
                <Title size="page">{pageTitle}</Title>
            </div>
            <ExplorerList />
        </Stack>
    );
}
