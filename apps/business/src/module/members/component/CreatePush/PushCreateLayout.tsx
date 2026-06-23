import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FloatingPhonePreview } from "@/module/common/component/FloatingPhonePreview";
import * as layout from "@/module/merchant/component/EditPageLayout/edit-page-layout.css";
import * as styles from "./push-create-layout.css";

/**
 * Immersive (bare-shell) chrome for the push composer: sticky toolbar with a
 * close button and title, the form column, and a floating phone preview.
 * Mirrors the merchant Edit pages' shell.
 */
export function PushCreateLayout({
    title,
    onClose,
    preview,
    children,
}: {
    title: string;
    onClose: () => void;
    preview: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className={layout.page}>
            <Stack
                as="header"
                space="m"
                className={clsx(layout.toolbar, layout.gutter)}
            >
                <GlassCloseButton
                    onClick={onClose}
                    aria-label={t("push.create.close")}
                />
                <Text as="h1">{title}</Text>
            </Stack>
            <div className={styles.row}>
                <div className={styles.formColumn}>{children}</div>
                <FloatingPhonePreview variant="sticky">
                    {preview}
                </FloatingPhonePreview>
            </div>
        </div>
    );
}
