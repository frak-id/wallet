import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./edit-page-layout.css";

export type EditPage = "customize" | "details" | "team";

const PAGE_ROUTES = {
    customize: "/m/$merchantId/merchant/customize",
    details: "/m/$merchantId/merchant",
    team: "/m/$merchantId/merchant/team",
} as const;

/**
 * Full-viewport chrome for the merchant Edit pages (no app shell): sticky
 * toolbar with a close button and the page title, then the tab bar switching
 * between the three Edit sections.
 */
export function EditPageLayout({
    merchantId,
    page,
    guardNavigate,
    children,
}: {
    merchantId: string;
    page: EditPage;
    /** Guard navigation through the discard modal (receives the deferred action). */
    guardNavigate?: (action: () => void) => void;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const guarded = (action: () => void) => {
        if (guardNavigate) {
            guardNavigate(action);
            return;
        }
        action();
    };

    return (
        <div className={styles.page}>
            <Stack
                as="header"
                space="m"
                className={clsx(styles.toolbar, styles.gutter)}
            >
                <GlassCloseButton
                    onClick={() =>
                        guarded(() =>
                            navigate({
                                to: "/m/$merchantId/dashboard",
                                params: { merchantId },
                            })
                        )
                    }
                    aria-label={t("merchantEdit.close")}
                />
                <Text as="h1">{t("merchantEdit.title")}</Text>
            </Stack>
            <div className={styles.gutter}>
                <Stack space="l" className={styles.content}>
                    <Tabs
                        value={page}
                        onValueChange={(value) =>
                            guarded(() =>
                                navigate({
                                    to: PAGE_ROUTES[value as EditPage],
                                    params: { merchantId },
                                })
                            )
                        }
                    >
                        <TabsList variant="navigation">
                            <TabsTrigger variant="navigation" value="customize">
                                {t("merchantEdit.tabs.identity")}
                            </TabsTrigger>
                            <TabsTrigger variant="navigation" value="details">
                                {t("merchantEdit.tabs.explorer")}
                            </TabsTrigger>
                            <TabsTrigger variant="navigation" value="team">
                                {t("merchantEdit.tabs.team")}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {children}
                </Stack>
            </div>
        </div>
    );
}
