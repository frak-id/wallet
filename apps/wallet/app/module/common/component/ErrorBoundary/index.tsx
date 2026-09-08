import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError } from "@frak-labs/wallet-shared";
import { CatchBoundary, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

/**
 * Fallback for a caught render error. Reads only the i18n provider, which
 * sits above the router, so it also serves the `_wallet` boundary that
 * fires when `AppShell` itself fails.
 */
export function ErrorFallback() {
    const { t } = useTranslation();
    const actionRef = useRef<HTMLButtonElement>(null);

    // The thrown subtree may have held focus; leaving it detached strands
    // keyboard users with no route to the only action on screen.
    useEffect(() => actionRef.current?.focus(), []);

    return (
        <Box role="alert" className={styles.fallback}>
            <Text variant="heading2">{t("wallet.errorFallback.title")}</Text>
            <Text variant="bodySmall" className={styles.description}>
                {t("wallet.errorFallback.message")}
            </Text>
            <Button
                ref={actionRef}
                // Assets are served immutable and the service worker caches
                // none of them, so a full load is what fetches the current
                // manifest. An in-place reset would re-render the same
                // stale bundle.
                onClick={() => location.reload()}
            >
                {t("wallet.errorFallback.reload")}
            </Button>
        </Box>
    );
}

/**
 * Contains a render error to the region it happened in. Mounted inside
 * `AppShell` so the shell's chrome survives, and on `_wallet`, which has none.
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
    // Keyed on pathname: `AppShell` outlives sibling navigation, and a
    // constant key would pin the fallback under a working tab bar.
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });

    return (
        <CatchBoundary
            getResetKey={() => pathname}
            onCatch={(error) =>
                recordError(error, {
                    source: "error_boundary",
                    context: { stage: "layout_content", route: pathname },
                })
            }
            errorComponent={ErrorFallback}
        >
            {children}
        </CatchBoundary>
    );
}
